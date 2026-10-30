const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');

function glob(pattern, text) {
  const re = new RegExp('^' + String(pattern).trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
  return re.test(text);
}

function matches(trigger, ev) {
  if (!trigger || trigger.type !== ev.type) return false;
  const v = trigger.value;
  if (v === undefined || v === null || v === '') return true;
  return String(v).split(',').some((p) => glob(p, String(ev.value)));
}

const template = (s, ev) =>
  String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (ev[k] !== undefined ? ev[k] : ''));

function speak(text) {
  if (!text) return;
  const done = (err) => err && console.warn('TTS fehlgeschlagen:', err.message);
  if (process.platform === 'darwin') execFile('say', [text], done);
  else execFile('spd-say', ['-l', 'de', text], (err) => {
    if (err) execFile('espeak-ng', ['-v', 'de', text], done);
  });
}

class ActionRunner {
  constructor({ getConfig, playSound, showOverlay }) {
    this.getConfig = getConfig;
    this.playSound = playSound;
    this.showOverlay = showOverlay;
  }

  handle(ev) {
    for (const rule of this.getConfig().rules ?? []) {
      if (rule.enabled !== false && matches(rule.trigger, ev)) this.run(rule.actions, ev);
    }
  }

  run(actions, ev) {
    for (const a of actions ?? []) {
      try {
        this.runOne(a, ev);
      } catch (err) {
        console.warn('Aktion fehlgeschlagen:', a.type, err.message);
      }
    }
  }

  runOne(a, ev) {
    switch (a.type) {
      case 'sound':
        if (a.file) this.playSound(pathToFileURL(a.file).href);
        break;
      case 'tts':
        speak(template(a.text, ev));
        break;
      case 'overlay':
        this.showOverlay({ text: template(a.text, ev), color: a.color, ms: Number(a.ms) || 2000 });
        break;
      case 'http': {
        const method = (a.method || 'GET').toUpperCase();
        const hasBody = !['GET', 'HEAD'].includes(method) && a.body;
        fetch(template(a.url, ev), {
          method,
          headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
          body: hasBody ? template(a.body, ev) : undefined,
          signal: AbortSignal.timeout(3000),
        }).catch((err) => console.warn('HTTP-Aktion fehlgeschlagen:', err.message));
        break;
      }
    }
  }
}

module.exports = { ActionRunner, matches, template };
