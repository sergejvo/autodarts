const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, ...args) => cb(...args));

contextBridge.exposeInMainWorld('kiosk', {
  setLayout: (m) => ipcRenderer.send('layout:set', m),
  reload: () => ipcRenderer.send('reload'),
  quit: () => ipcRenderer.send('quit'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (c) => ipcRenderer.invoke('config:set', c),
  testRule: (r) => ipcRenderer.send('rule:test', r),
  pickSound: () => ipcRenderer.invoke('dialog:pickSound'),
  onLayout: on('layout'),
  onSound: on('sound'),
  onOverlay: on('overlay:show'),
  onEvent: on('event'),
  onRefresh: on('settings:refresh'),
});
