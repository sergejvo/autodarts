const el = document.getElementById('t');
kiosk.onOverlay(({ text, color, ms }) => {
  el.classList.remove('go');
  void el.offsetWidth; // Animation neu starten
  el.textContent = text;
  el.style.color = color || '#fff';
  el.style.setProperty('--ms', `${ms}ms`);
  el.classList.add('go');
});
