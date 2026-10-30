const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULTS = {
  playUrl: 'https://autodarts.com/play',
  managerUrl: 'http://localhost:3180',
  kiosk: false,
  defaultLayout: 'split',
  debug: false,
  rules: [
    {
      id: 'demo-180',
      name: '180!',
      enabled: true,
      trigger: { type: 'turnScore', value: '180' },
      actions: [
        { type: 'overlay', text: '180!', color: '#ffd400', ms: 2500 },
        { type: 'tts', text: 'Einhundertachtzig!' },
      ],
    },
    {
      id: 'demo-bull',
      name: 'Bullseye',
      enabled: true,
      trigger: { type: 'throw', value: 'BULL' },
      actions: [{ type: 'overlay', text: 'BULLSEYE', color: '#e63946', ms: 1500 }],
    },
  ],
};

const file = () => path.join(app.getPath('userData'), 'config.json');

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(cfg) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cfg, null, 2));
}

module.exports = { load, save, DEFAULTS };
