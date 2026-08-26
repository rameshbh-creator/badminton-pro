const assert = require('assert');
const { createClub, login, getSnapshot, putSnapshot, listOnline } = require('./club.js');

const club = createClub('1234');

const badPin = login(club, 'Ramesh', '0000');
assert.strictEqual(badPin.ok, false);

const noName = login(club, '   ', '1234');
assert.strictEqual(noName.ok, false);

const ramesh = login(club, 'Ramesh', '1234');
assert.strictEqual(ramesh.ok, true);
assert.ok(ramesh.token);

const unauthorized = getSnapshot(club, 'nope');
assert.strictEqual(unauthorized.ok, false);
assert.strictEqual(unauthorized.status, 401);

const snap = getSnapshot(club, ramesh.token);
assert.strictEqual(snap.ok, true);
assert.strictEqual(snap.state.screen, 'setup');
assert.strictEqual(snap.state.rev, 0);

const saved = putSnapshot(club, ramesh.token, {
  rev: 0,
  screen: 'session',
  courts: 2,
  scoreTarget: 15,
  players: [{ id: 'p1', name: 'Ajay' }],
});
assert.strictEqual(saved.ok, true);
assert.strictEqual(saved.state.rev, 1);
assert.strictEqual(saved.state.scoreTarget, 15);

const stale = putSnapshot(club, ramesh.token, { rev: 0, screen: 'setup' });
assert.strictEqual(stale.ok, false);
assert.strictEqual(stale.status, 409);
assert.strictEqual(stale.state.rev, 1);

const ajay = login(club, 'Ajay', '1234');
const names = listOnline(club).sort();
assert.deepStrictEqual(names, ['Ajay', 'Ramesh']);

const ajayView = getSnapshot(club, ajay.token);
assert.strictEqual(ajayView.state.scoreTarget, 15);
assert.strictEqual(ajayView.state.screen, 'session');

console.log('club.test.js passed');
