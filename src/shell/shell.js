const buttons = [...document.querySelectorAll('[data-mode]')];
buttons.forEach((b) => b.addEventListener('click', () => kiosk.setLayout(b.dataset.mode)));
document.getElementById('reload').addEventListener('click', () => kiosk.reload());
document.getElementById('quit').addEventListener('click', () => {
  if (confirm('Kiosk beenden?')) kiosk.quit();
});
kiosk.onLayout((mode) => buttons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode)));
kiosk.onSound((url) => new Audio(url).play().catch((e) => console.warn(e)));
