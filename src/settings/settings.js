let cfg;

const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => el.append(k));
  return el;
};

function field(label, obj, key, { type = 'text', cls = '', rerender } = {}) {
  const input = h('input', { type, value: obj[key] ?? '', className: cls });
  input.addEventListener('input', () => {
    obj[key] = type === 'number' ? Number(input.value) : input.value;
    rerender && rerender();
  });
  return h('div', { className: 'row' }, h('label', { textContent: label }), input);
}

function check(label, obj, key) {
  const input = h('input', { type: 'checkbox', checked: !!obj[key] });
  input.addEventListener('change', () => (obj[key] = input.checked));
  return h('div', { className: 'row' }, h('label', { textContent: label }), input);
}

function select(obj, key, options, onChange) {
  const s = h('select', {}, options.map(([v, t]) => h('option', { value: v, textContent: t, selected: obj[key] === v })));
  s.addEventListener('change', () => { obj[key] = s.value; onChange && onChange(); });
  return s;
}

const ACTION_TYPES = [['sound', 'Sound abspielen'], ['tts', 'Sprachausgabe'], ['overlay', 'Overlay'], ['http', 'HTTP-Aufruf (Licht/Hardware)']];
const TRIGGERS = [['throw', 'Einzelwurf'], ['turnScore', 'Aufnahme-Summe'], ['bust', 'Bust'], ['turnEnd', 'Aufnahme beendet']];

function actionEditor(rule, a) {
  const box = h('div', { className: 'action' });
  box.append(h('div', { className: 'row' }, select(a, 'type', ACTION_TYPES, render),
    h('button', { className: 'danger', textContent: 'Entfernen', onclick: () => { rule.actions.splice(rule.actions.indexOf(a), 1); render(); } })));
  if (a.type === 'sound') {
    const f = field('Datei', a, 'file', { cls: 'grow' });
    f.append(h('button', { textContent: 'Wählen …', onclick: async () => { const p = await kiosk.pickSound(); if (p) { a.file = p; render(); } } }));
    box.append(f);
  } else if (a.type === 'tts') box.append(field('Text', a, 'text', { cls: 'grow' }));
  else if (a.type === 'overlay') {
    box.append(field('Text', a, 'text', { cls: 'grow' }), field('Farbe', a, 'color'), field('Dauer (ms)', a, 'ms', { type: 'number' }));
  } else if (a.type === 'http') {
    box.append(h('div', { className: 'row' }, h('label', { textContent: 'Methode' }), select(a, 'method', ['GET', 'POST', 'PUT'].map((m) => [m, m]))),
      field('URL', a, 'url', { cls: 'grow' }), field('Body (JSON)', a, 'body', { cls: 'grow' }));
  }
  return box;
}

function ruleEditor(rule) {
  const card = h('div', { className: 'card' });
  card.append(h('div', { className: 'row' }, check('Aktiv', rule, 'enabled'), field('Name', rule, 'name', { cls: 'grow' })));
  card.append(h('div', { className: 'row' }, h('label', { textContent: 'Trigger' }), select(rule.trigger, 'type', TRIGGERS),
    h('input', { type: 'text', value: rule.trigger.value ?? '', placeholder: 'Wert, z. B. T20 / 180', oninput: (e) => (rule.trigger.value = e.target.value) })));
  rule.actions.forEach((a) => card.append(actionEditor(rule, a)));
  card.append(h('div', { className: 'row' },
    h('button', { textContent: '+ Aktion', onclick: () => { rule.actions.push({ type: 'overlay', text: '{value}', color: '#ffd400', ms: 2000 }); render(); } }),
    h('button', { textContent: '▶ Testen', onclick: () => kiosk.testRule(rule) }),
    h('button', { className: 'danger', textContent: 'Regel löschen', onclick: () => { cfg.rules.splice(cfg.rules.indexOf(rule), 1); render(); } })));
  return card;
}

function render() {
  const g = document.getElementById('general');
  g.replaceChildren(
    field('Play-URL', cfg, 'playUrl', { cls: 'grow' }),
    field('Board-Manager', cfg, 'managerUrl', { cls: 'grow' }),
    check('Kiosk-Start', cfg, 'kiosk'),
    check('Debug-Log', cfg, 'debug'),
  );
  document.getElementById('rules').replaceChildren(...cfg.rules.map(ruleEditor));
}

async function init() {
  cfg = await kiosk.getConfig();
  render();
}

document.getElementById('addRule').addEventListener('click', () => {
  cfg.rules.push({ id: String(Date.now()), name: 'Neue Regel', enabled: true, trigger: { type: 'throw', value: 'T20' }, actions: [] });
  render();
});
document.getElementById('save').addEventListener('click', async () => {
  await kiosk.setConfig(cfg);
  const s = document.getElementById('status');
  s.textContent = 'Gespeichert ✓';
  setTimeout(() => (s.textContent = ''), 2000);
});

const log = document.getElementById('log');
const lines = [];
kiosk.onEvent((ev) => {
  lines.unshift(`${new Date().toLocaleTimeString()}  ${ev.type.padEnd(10)} ${ev.value}  (${ev.points} Pkt) ${ev.player || ''}`);
  lines.length = Math.min(lines.length, 30);
  log.textContent = lines.join('\n');
});
kiosk.onRefresh(init);
init();
