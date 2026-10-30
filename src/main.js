const path = require('node:path');
const fs = require('node:fs');
const { app, BaseWindow, WebContentsView, ipcMain, dialog } = require('electron');
const config = require('./config');
const { ActionRunner } = require('./actions');
const { createDetector } = require('./detector');

const TOOLBAR_H = 56;
let cfg;
let win;
let layoutMode = 'play';
const views = {};
const detectors = new Map();
let overlayTimer = null;

const preload = (name) => path.join(__dirname, name);
const sendTo = (view, channel, ...args) => view && !view.webContents.isDestroyed() && view.webContents.send(channel, ...args);

function makeView(file, preloadFile, extra = {}) {
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, preload: preload(preloadFile), ...extra },
  });
  win.contentView.addChildView(view);
  if (file) view.webContents.loadFile(file);
  return view;
}

function makeWebView(url, partition) {
  const view = makeView(null, 'preload-web.js', { partition });
  const wc = view.webContents;
  // Popups (z. B. Login) im selben View öffnen statt neues Fenster
  wc.setWindowOpenHandler(({ url: u }) => {
    wc.loadURL(u);
    return { action: 'deny' };
  });
  // Board-Manager startet ggf. später als die App -> Laden erneut versuchen
  wc.on('did-fail-load', (_e, code, _d, failedUrl, isMainFrame) => {
    if (isMainFrame && code !== -3) setTimeout(() => !wc.isDestroyed() && wc.loadURL(failedUrl), 3000);
  });
  wc.loadURL(url);
  return view;
}

function applyLayout() {
  const { width, height } = win.getContentBounds();
  const body = { x: 0, y: TOOLBAR_H, width, height: height - TOOLBAR_H };
  const visible = new Set();
  views.shell.setBounds({ x: 0, y: 0, width, height: TOOLBAR_H });

  if (layoutMode === 'split') {
    const left = Math.round(body.width * 0.68);
    views.play.setBounds({ ...body, width: left });
    views.manager.setBounds({ ...body, x: left, width: body.width - left });
    visible.add('play').add('manager');
  } else {
    views[layoutMode].setBounds(body);
    visible.add(layoutMode);
  }
  for (const name of ['play', 'manager', 'settings']) views[name].setVisible(visible.has(name));
  sendTo(views.shell, 'layout', layoutMode);
  if (layoutMode === 'settings') sendTo(views.settings, 'settings:refresh');
}

function setLayout(mode) {
  if (!['play', 'manager', 'split', 'settings'].includes(mode)) return;
  layoutMode = mode;
  applyLayout();
}

function showOverlay(payload) {
  if (!views.overlay) return;
  const { width, height } = win.getContentBounds();
  clearTimeout(overlayTimer);
  // Overlay-View nur während der Anzeige einhängen, damit sie keine Eingaben abfängt
  win.contentView.addChildView(views.overlay);
  views.overlay.setBounds({ x: 0, y: 0, width, height });
  sendTo(views.overlay, 'overlay:show', payload);
  overlayTimer = setTimeout(() => win.contentView.removeChildView(views.overlay), payload.ms + 400);
}

function onKey(event, input) {
  if (input.type !== 'keyDown') return;
  const map = { F1: 'play', F2: 'manager', F3: 'split', F4: 'settings' };
  if (map[input.key]) return event.preventDefault(), setLayout(map[input.key]);
  if (input.key === 'F11') return event.preventDefault(), win.setFullScreen(!win.isFullScreen());
  if (input.key === 'F5') return event.preventDefault(), reloadActive();
  if ((input.control || input.meta) && input.key.toLowerCase() === 'q') app.quit();
}

function reloadActive() {
  const names = layoutMode === 'split' ? ['play', 'manager'] : [layoutMode];
  names.forEach((n) => views[n].webContents.reload());
}

function createWindow() {
  layoutMode = ['play', 'manager', 'split'].includes(cfg.defaultLayout) ? cfg.defaultLayout : 'play';
  const kiosk = cfg.kiosk || process.argv.includes('--kiosk');
  win = new BaseWindow({ width: 1280, height: 800, fullscreen: kiosk, autoHideMenuBar: true, backgroundColor: '#0b0e14' });

  views.play = makeWebView(cfg.playUrl, 'persist:play');
  views.manager = makeWebView(cfg.managerUrl, 'persist:manager');
  views.settings = makeView(path.join(__dirname, 'settings/index.html'), 'preload-ui.js');
  views.shell = makeView(path.join(__dirname, 'shell/index.html'), 'preload-ui.js');
  views.overlay = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, preload: preload('preload-ui.js') },
  });
  views.overlay.setBackgroundColor('#00000000');
  views.overlay.webContents.loadFile(path.join(__dirname, 'overlay/index.html'));

  for (const v of Object.values(views)) v.webContents.on('before-input-event', onKey);
  win.on('resize', applyLayout);
  win.on('closed', () => app.quit());
  applyLayout();
  views.shell.webContents.once('did-finish-load', applyLayout);
}

const runner = new ActionRunner({
  getConfig: () => cfg,
  playSound: (url) => sendTo(views.shell, 'sound', url),
  showOverlay,
});

function logEvent(ev) {
  sendTo(views.settings, 'event', ev);
}

app.whenReady().then(() => {
  cfg = config.load();
  createWindow();

  ipcMain.on('ws', (e, { url, data }) => {
    if (cfg.debug) {
      const log = path.join(app.getPath('userData'), 'ws-debug.log');
      fs.appendFile(log, `${new Date().toISOString()} ${url}\n${String(data).slice(0, 4000)}\n`, () => {});
    }
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    const id = e.sender.id;
    if (!detectors.has(id)) detectors.set(id, createDetector());
    for (const ev of detectors.get(id)(msg)) {
      logEvent(ev);
      runner.handle(ev);
    }
  });

  ipcMain.on('layout:set', (_e, mode) => setLayout(mode));
  ipcMain.on('reload', reloadActive);
  ipcMain.handle('config:get', () => cfg);
  ipcMain.handle('config:set', (_e, next) => {
    const urlsChanged = next.playUrl !== cfg.playUrl || next.managerUrl !== cfg.managerUrl;
    cfg = next;
    config.save(cfg);
    if (urlsChanged) {
      views.play.webContents.loadURL(cfg.playUrl);
      views.manager.webContents.loadURL(cfg.managerUrl);
    }
    return true;
  });
  ipcMain.on('rule:test', (_e, rule) => runner.run(rule.actions, { type: 'test', value: 'T20', points: 60, player: 'Test' }));
  ipcMain.handle('dialog:pickSound', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }], properties: ['openFile'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.on('quit', () => app.quit());
});

app.on('window-all-closed', () => app.quit());
