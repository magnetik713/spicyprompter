document.addEventListener('DOMContentLoaded', function () {
  var fileInput = document.querySelector('input[name="workflow_json"]');
  if (!fileInput) return;

  fileInput.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        var ksampler = findKSampler(data);
        if (!ksampler) return;
        fillField('steps', ksampler.steps);
        fillField('cfg_scale', ksampler.cfg);
        fillField('denoise', ksampler.denoise);
        fillSelect('sampler', ksampler.sampler_name);
        fillSelect('scheduler', ksampler.scheduler);
      } catch (err) {}
    };
    reader.readAsText(file);
  });

  function findKSampler(data) {
    // API format: { "3": { class_type: "KSampler", inputs: {...} } }
    if (data && typeof data === 'object' && !data.nodes) {
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var node = data[keys[i]];
        if (node && node.class_type === 'KSampler' && node.inputs) {
          return { steps: node.inputs.steps, cfg: node.inputs.cfg,
                   sampler_name: node.inputs.sampler_name,
                   scheduler: node.inputs.scheduler, denoise: node.inputs.denoise };
        }
      }
    }
    // UI format: { nodes: [{ type: "KSampler", widgets_values: [...] }] }
    if (data && data.nodes && Array.isArray(data.nodes)) {
      var node = data.nodes.find(function (n) { return n.type === 'KSampler'; });
      if (node && node.widgets_values) {
        // order: seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise
        return { steps: node.widgets_values[2], cfg: node.widgets_values[3],
                 sampler_name: node.widgets_values[4], scheduler: node.widgets_values[5],
                 denoise: node.widgets_values[6] };
      }
    }
    return null;
  }

  function fillField(name, value) {
    if (value == null) return;
    var el = document.querySelector('input[name="' + name + '"]');
    if (el) el.value = value;
  }

  function fillSelect(name, value) {
    if (!value) return;
    var el = document.querySelector('select[name="' + name + '"]');
    if (!el) return;
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value.toLowerCase() === value.toLowerCase()) {
        el.value = el.options[i].value;
        return;
      }
    }
  }
});
