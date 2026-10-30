const fs = require('node:fs');

const MAX_BYTES = 5 * 1024 * 1024;
const WINDOW_MS = 30000;

// Kompaktes Debug-Log: pro Topic nur die erste Nachricht komplett, danach nur Nachrichten,
// die nach Wurf-Daten aussehen (und sich geändert haben). Dazu alle 30 s eine Zählerzeile.
function createDebugLog(file) {
  const first = new Set();
  const lastBody = new Map();
  const counts = new Map();
  let written = 0;
  let timer = null;

  const write = (line) => {
    if (written > MAX_BYTES) {
      fs.rename(file, `${file}.old`, () => {});
      written = 0;
    }
    written += line.length;
    fs.appendFile(file, line, () => {});
  };

  const flush = () => {
    if (!counts.size) return;
    const summary = [...counts].map(([k, n]) => `${k}=${n}`).join('  ');
    write(`${new Date().toISOString()} [summary/${WINDOW_MS / 1000}s] ${summary}\n`);
    counts.clear();
  };

  return function log({ kind, url, data }, msg) {
    if (!timer) timer = setInterval(flush, WINDOW_MS).unref();
    if (kind !== 'text') {
      const k = `${kind}:${url}`;
      if (!first.has(k)) {
        first.add(k);
        write(`${new Date().toISOString()} [${kind}] ${url}\n`);
      }
      return;
    }
    const topic = msg
      ? [msg.channel, msg.topic, msg.type].filter(Boolean).join('/') || Object.keys(msg).join(',')
      : '(kein JSON)';
    counts.set(topic, (counts.get(topic) ?? 0) + 1);

    const isNew = !first.has(topic);
    const looksLikeThrow = /throw|segment|dart/i.test(data);
    if (isNew) first.add(topic);
    if (!isNew && !(looksLikeThrow && lastBody.get(topic) !== data)) return;
    lastBody.set(topic, data);
    write(`${new Date().toISOString()} [text] ${isNew ? 'NEU ' : ''}${topic}  (${url})\n${data.slice(0, 4000)}\n`);
  };
}

module.exports = { createDebugLog };
