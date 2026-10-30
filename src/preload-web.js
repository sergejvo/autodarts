// Läuft in Play-Seite und Board-Manager. Hängt sich in WebSocket ein und leitet Nachrichten
// an den Hauptprozess weiter (Hook im Main World, Brücke per postMessage).
const { ipcRenderer, webFrame } = require('electron');

webFrame.executeJavaScript(`(() => {
  if (window.__adHooked) return;
  window.__adHooked = true;
  const Orig = window.WebSocket;
  function Hooked(url, protocols) {
    const ws = protocols !== undefined ? new Orig(url, protocols) : new Orig(url);
    ws.addEventListener('message', (e) => {
      if (typeof e.data === 'string') window.postMessage({ __adws: true, url: String(url), data: e.data }, '*');
    });
    return ws;
  }
  Hooked.prototype = Orig.prototype;
  Object.setPrototypeOf(Hooked, Orig);
  window.WebSocket = Hooked;
})();`);

window.addEventListener('message', (e) => {
  if (e.source === window && e.data && e.data.__adws) {
    ipcRenderer.send('ws', { url: e.data.url, data: e.data.data });
  }
});
