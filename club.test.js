const assert = require('assert');
const { createClub, login, getSnapshot, putSnapshot, listOnline, addToRoster } = require('./club.js');

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

// Netlify functions load club state from blobs per request. The instance that
// handles GET /api/state may not yet see the token Map written by login.
// Auth must still succeed from the token itself.
const otherInstance = createClub('1234');
const crossInstance = getSnapshot(otherInstance, ramesh.token);
assert.strictEqual(crossInstance.ok, true, 'login token must work on a club instance that never stored it');
assert.strictEqual(crossInstance.state.screen, 'setup');


// A client cannot replay the session-end transition to double-award roster
// points, even by forging historySaved:false on the PUT body.
const pointsClub = createClub('1234');
const pointsHost = login(pointsClub, 'Host', '1234');
const pointsPlayer = addToRoster(pointsClub, 'Ajay', 4).player;

const toSession = putSnapshot(pointsClub, pointsHost.token, { rev: 0, screen: 'session' });
const finalMap = { [pointsPlayer.id]: { id: pointsPlayer.id, sessionPoints: 10, wins: 1, roundsPlayed: 1 } };
const toSummary = putSnapshot(pointsClub, pointsHost.token, {
  rev: toSession.state.rev,
  screen: 'summary',
  finalMap,
  roundsPlayed: 1,
});
assert.strictEqual(toSummary.ok, true);
assert.strictEqual(pointsClub.roster[0].totalPoints, 10);

// Attacker: bounce back to 'session' then forge another summary transition
// with historySaved:false to try to re-trigger the point award.
const replayToSession = putSnapshot(pointsClub, pointsHost.token, { rev: toSummary.state.rev, screen: 'session' });
const replaySummary = putSnapshot(pointsClub, pointsHost.token, {
  rev: replayToSession.state.rev,
  screen: 'summary',
  finalMap,
  roundsPlayed: 1,
  historySaved: false,
});
assert.strictEqual(replaySummary.ok, true);
assert.strictEqual(pointsClub.roster[0].totalPoints, 10, 'points must not be double-awarded via a forged historySaved');

console.log('club.test.js passed');
