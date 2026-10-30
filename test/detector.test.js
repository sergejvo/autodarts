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
