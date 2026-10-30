const test = require('node:test');
const assert = require('node:assert');
const { createDetector, normalizeThrow } = require('../src/detector');
const { matches } = require('../src/actions');

const t = (number, multiplier) => ({ segment: { number, multiplier } });
const msg = (throws, id = 'a') => ({ data: { player: 'Anna', turn: { id, throws } } });

test('normalizeThrow', () => {
  assert.deepStrictEqual(normalizeThrow(t(20, 3)), { value: 'T20', points: 60 });
  assert.deepStrictEqual(normalizeThrow(t(25, 2)), { value: 'BULL', points: 50 });
  assert.deepStrictEqual(normalizeThrow(t(25, 1)), { value: '25', points: 25 });
  assert.deepStrictEqual(normalizeThrow(t(0, 0)), { value: 'MISS', points: 0 });
  assert.deepStrictEqual(normalizeThrow({ segment: { name: 'D16' } }), { value: 'D16', points: 32 });
});

test('180 erzeugt turnScore, wiederholte States keine Duplikate', () => {
  const feed = createDetector();
  assert.strictEqual(feed(msg([t(20, 3)])).length, 1);
  assert.strictEqual(feed(msg([t(20, 3)])).length, 0);
  assert.strictEqual(feed(msg([t(20, 3), t(20, 3)])).length, 1);
  const last = feed(msg([t(20, 3), t(20, 3), t(20, 3)]));
  assert.deepStrictEqual(last.map((e) => e.type), ['throw', 'turnScore', 'turnEnd']);
  assert.strictEqual(last[1].value, '180');
  assert.strictEqual(feed(msg([t(20, 3), t(20, 3), t(20, 3)])).length, 0);
});

test('neue Aufnahme setzt Zähler zurück', () => {
  const feed = createDetector();
  feed(msg([t(1, 1)], 'a'));
  assert.strictEqual(feed(msg([t(5, 1)], 'b')).length, 1);
});

test('Trigger-Matching mit Wildcards und Listen', () => {
  assert.ok(matches({ type: 'throw', value: 'D*' }, { type: 'throw', value: 'D20' }));
  assert.ok(matches({ type: 'throw', value: 'T20, BULL' }, { type: 'throw', value: 'BULL' }));
  assert.ok(!matches({ type: 'throw', value: 'T20' }, { type: 'throw', value: 'S20' }));
  assert.ok(matches({ type: 'throw', value: '' }, { type: 'throw', value: 'MISS' }));
});

const bm = (...names) => ({
  type: 'state',
  data: { throws: names.map((n) => ({ segmentName: n, segmentNumber: parseInt(n.slice(1), 10), multiplier: { S: 1, D: 2, T: 3 }[n[0]] })) },
});

test('Board-Manager: Schnappschuss erzeugt keine Events, neue Darts schon', () => {
  const feed = createDetector();
  assert.strictEqual(feed(bm('S18', 'D20', 'S1')).length, 0); // alte Darts beim Verbinden
  assert.strictEqual(feed({ type: 'state', data: { throws: [] } }).length, 0); // Entnahme nach bereits beendeter Aufnahme
  assert.deepStrictEqual(feed(bm('T20')).map((e) => e.value), ['T20']);
  assert.strictEqual(feed(bm('T20')).length, 0);
  assert.deepStrictEqual(feed(bm('T20', 'T20')).map((e) => e.value), ['T20']);
  const last = feed(bm('T20', 'T20', 'T20'));
  assert.deepStrictEqual(last.map((e) => e.type), ['throw', 'turnScore', 'turnEnd']);
  assert.strictEqual(last[1].value, '180');
  assert.strictEqual(feed({ type: 'state', data: { throws: [] } }).length, 0);
});

test('Board-Manager: vorzeitige Entnahme beendet die Aufnahme', () => {
  const feed = createDetector();
  feed({ type: 'state', data: { throws: [] } });
  feed(bm('S5'));
  const end = feed({ type: 'state', data: { throws: [] } });
  assert.deepStrictEqual(end.map((e) => e.type), ['turnScore', 'turnEnd']);
  assert.strictEqual(end[0].value, '5');
});
