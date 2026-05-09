document.addEventListener('DOMContentLoaded', function () {
  var dl = document.getElementById('lora-list');
  if (!dl) return;

  var allLoras = [];

  fetch('/prompts/api/loras')
    .then(function (r) { return r.json(); })
    .then(function (loras) {
      allLoras = loras.map(function (n) { return n.split('/').pop().split('\\').pop(); });
      renderLoras(getBaseModel());
    })
    .catch(function () {});

  // Re-filter when workflow changes
  var wfSelect = document.querySelector('select[name="workflow_id"]');
  if (wfSelect) {
    wfSelect.addEventListener('change', function () {
      var id = this.value;
      if (!id) { renderLoras(getBaseModel()); return; }
      fetch('/prompts/api/workflow/' + id)
        .then(function (r) { return r.json(); })
        .then(function (wf) {
          var bm = document.querySelector('input[name="base_model"]');
          if (bm && !bm.value && wf.base_model) bm.value = wf.base_model;
          renderLoras(wf.base_model || getBaseModel());
        })
        .catch(function () {});
    });
  }

  // Re-filter when base_model typed manually
  var bmInput = document.querySelector('input[name="base_model"]');
  if (bmInput) {
    bmInput.addEventListener('input', function () { renderLoras(this.value); });
  }

  function getBaseModel() {
    var el = document.querySelector('input[name="base_model"]');
    return el ? el.value : '';
  }

  function loraMatchesModel(name, model) {
    var l = name.toLowerCase();
    var m = (model || '').toLowerCase();
    if (!m) return true;
    if (m.includes('wan')) return l.includes('wan') || l.includes('i2v') || l.includes('t2v') || l.includes('14b');
    if (m.includes('flux')) return l.includes('flux');
    if (m.includes('sdxl') || m.includes('pony')) return l.includes('sdxl') || l.includes('pony') || l.includes('xl');
    if (m.includes('sd1') || m.includes('1.5')) return !l.includes('xl') && !l.includes('flux') && !l.includes('wan');
    return true;
  }

  function renderLoras(model) {
    dl.innerHTML = '';
    allLoras.forEach(function (name) {
      if (loraMatchesModel(name, model)) {
        var opt = document.createElement('option');
        opt.value = name;
        dl.appendChild(opt);
      }
    });
  }
});
