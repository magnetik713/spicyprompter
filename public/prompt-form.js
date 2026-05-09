document.addEventListener('DOMContentLoaded', function () {
  var dl = document.getElementById('lora-list');
  if (!dl) return;
  fetch('/prompts/api/loras')
    .then(function (r) { return r.json(); })
    .then(function (loras) {
      loras.forEach(function (name) {
        var opt = document.createElement('option');
        // Strip path prefix if present, keep basename
        opt.value = name.split('/').pop().split('\\').pop();
        dl.appendChild(opt);
      });
    })
    .catch(function () {});
});
