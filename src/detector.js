// Wandelt Autodarts-WebSocket-Nachrichten in Wurf-Events um.
// Das Nachrichtenformat ist nicht offiziell dokumentiert, daher wird tolerant geparst
// (siehe README: mit "debug" kann man rohe Nachrichten mitschneiden und die Heuristik anpassen).

function normalizeThrow(t) {
  // Board-Manager: flach (segmentName/segmentNumber/multiplier); Play-Seite: verschachtelt (segment.*)
  const seg = t?.segment ?? {
    number: t?.segmentNumber,
    multiplier: t?.multiplier,
    name: t?.segmentName,
  };
  let number = Number(seg.number);
  let mult = Number(seg.multiplier);
  const name = String(seg.name ?? '').toUpperCase();
  if (!Number.isFinite(number)) number = parseInt(name.replace(/\D/g, ''), 10);
  if (!Number.isFinite(mult)) mult = name.startsWith('T') ? 3 : name.startsWith('D') ? 2 : 1;
  if (!Number.isFinite(number) || number === 0 || name === 'OUT' || name === 'M') {
    return { value: 'MISS', points: 0 };
  }
  const points = number * mult;
  if (number === 25) return { value: mult === 2 ? 'BULL' : '25', points };
  return { value: `${mult === 3 ? 'T' : mult === 2 ? 'D' : 'S'}${number}`, points };
}

function currentTurn(data) {
  if (data?.turn && Array.isArray(data.turn.throws)) return data.turn;
  if (Array.isArray(data?.turns) && data.turns.length) {
    return data.turns[data.turns.length - 1];
  }
  return null;
}

function endEvents(player, total, busted = false) {
  const events = [];
  if (busted) events.push({ type: 'bust', player, value: 'BUST', points: total });
  events.push({ type: 'turnScore', player, value: String(total), points: total });
  events.push({ type: 'turnEnd', player, value: String(total), points: total });
  return events;
}

const sum = (throws) => throws.reduce((s, t) => s + normalizeThrow(t).points, 0);

// Board-Manager (ws://localhost:3180/api/events/system): {type:'state', data:{throws:[...]}}.
// Die Liste wächst pro Dart und wird beim Entnehmen der Darts wieder leer.
function createStateFeed() {
  let seen = null;
  let current = [];
  let ended = false;

  return function feedState(data) {
    const throws = data.throws;
    const events = [];
    if (seen === null) {
      // Erste Nachricht nach Verbindungsaufbau ist nur ein Schnappschuss, keine neuen Würfe
      seen = throws.length;
      current = throws;
      ended = throws.length >= 3;
      return events;
    }
    if (throws.length < seen) {
      if (!ended && current.length) events.push(...endEvents('', sum(current)));
      seen = 0;
      ended = false;
    }
    for (let i = seen; i < throws.length; i++) {
      events.push({ type: 'throw', player: '', ...normalizeThrow(throws[i]) });
    }
    seen = throws.length;
    current = throws;
    if (!ended && throws.length >= 3) {
      ended = true;
      events.push(...endEvents('', sum(throws)));
    }
    return events;
  };
}

function createDetector() {
  const feedState = createStateFeed();
  let turnKey = null;
  let seen = 0;
  let turnEndEmitted = false;

  return function feed(msg) {
    const data = msg?.data;
    if (msg?.type === 'state' && Array.isArray(data?.throws)) return feedState(data);
    const turn = currentTurn(data);
    if (!turn || !Array.isArray(turn.throws)) return [];

    const key = turn.id ?? `${turn.round ?? ''}-${turn.playerId ?? turn.player ?? ''}-${turn.turn ?? ''}`;
    if (key !== turnKey) {
      turnKey = key;
      seen = 0;
      turnEndEmitted = false;
    }

    const player = data.player ?? data.activePlayer ?? turn.playerName ?? '';
    const throws = turn.throws;
    const events = [];

    if (throws.length < seen) {
      seen = throws.length; // Korrektur / Darts entnommen
      turnEndEmitted = false;
    }
    for (let i = seen; i < throws.length; i++) {
      const n = normalizeThrow(throws[i]);
      events.push({ type: 'throw', player, ...n });
    }
    seen = throws.length;

    const total = throws.reduce((s, t) => s + normalizeThrow(t).points, 0);
    const done = throws.length >= 3 || turn.finished === true || turn.busted === true;
    if (done && !turnEndEmitted) {
      turnEndEmitted = true;
      events.push(...endEvents(player, total, turn.busted));
    }
    return events;
  };
}

module.exports = { createDetector, normalizeThrow };
