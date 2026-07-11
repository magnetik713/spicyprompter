document.addEventListener('click', function (e) {
  if (!e.target.classList.contains('copy-btn')) return;
  const el = document.getElementById(e.target.dataset.target);
  if (!el) return;
  const text = (el.tagName === "TEXTAREA" ? el.value : el.textContent).trim();
  const btn = e.target;
  const others = document.querySelectorAll('.copy-btn');

  function flash() {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('active');
    others.forEach(function(b) { if (b !== btn) b.classList.add('dimmed'); });
    setTimeout(function() {
      btn.textContent = orig;
      btn.classList.remove('active');
      others.forEach(function(b) { b.classList.remove('dimmed'); });
    }, 1500);
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(flash);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    flash();
  }
});
