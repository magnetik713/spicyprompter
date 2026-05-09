document.addEventListener('click', function (e) {
  if (!e.target.classList.contains('copy-btn')) return;
  const targetId = e.target.dataset.target;
  const el = document.getElementById(targetId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).then(() => {
    const orig = e.target.textContent;
    e.target.textContent = 'Copied!';
    setTimeout(() => { e.target.textContent = orig; }, 1500);
  });
});
