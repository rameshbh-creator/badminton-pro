const assert = require('assert');
const { createClub, addToRoster, updateRosterPlayer, removeFromRoster, resetClub, login, recordSessionResults } = require('./club.js');

const club = createClub('2026');

const added = addToRoster(club, 'Ramesh', 4);
assert.strictEqual(added.ok, true);
assert.strictEqual(added.roster.length, 1);
assert.strictEqual(added.roster[0].name, 'Ramesh');
assert.strictEqual(added.roster[0].rating, 4);

const dup = addToRoster(club, 'ramesh', 5);
assert.strictEqual(dup.ok, true);
assert.strictEqual(dup.roster.length, 1);
assert.strictEqual(dup.roster[0].rating, 5);

const updated = updateRosterPlayer(club, added.roster[0].id, { rating: 3 });
assert.strictEqual(updated.ok, true);
assert.strictEqual(updated.roster[0].rating, 3);

const removed = removeFromRoster(club, added.roster[0].id);
assert.strictEqual(removed.ok, true);
assert.strictEqual(removed.roster.length, 0);

addToRoster(club, 'Ajay', 4);
addToRoster(club, 'Sam', 3);
const user = login(club, 'Host', '2026');
club.state = { ...club.state, rev: 2, players: [{ id: 'x', name: 'Ajay' }] };
const reset = resetClub(club, user.token);
assert.strictEqual(reset.ok, true);
assert.strictEqual(reset.state.players.length, 0);
assert.strictEqual(reset.roster.length, 2);
// rev must keep climbing across a reset — a client polling with a cached
// rev of 2 must not see the post-reset state look "stale" and get ignored.
assert.ok(reset.state.rev > 2, `expected rev to advance past 2, got ${reset.state.rev}`);

const historyClub = createClub('2026');
const saved = addToRoster(historyClub, 'Ramesh', 4);
recordSessionResults(historyClub, {
  [saved.player.id]: {
    id: saved.player.id,
    sessionPoints: 12,
    wins: 3,
    roundsPlayed: 5,
    roundsOnBench: 1,
    pointsScored: 45,
    pointsAgainst: 38,
  },
}, 5);
assert.strictEqual(historyClub.roster[0].totalPoints, 12);
assert.strictEqual(historyClub.roster[0].sessionsPlayed, 1);
assert.strictEqual(historyClub.roster[0].history.length, 1);
assert.strictEqual(historyClub.roster[0].history[0].sessionPoints, 12);
assert.strictEqual(historyClub.roster[0].history[0].wins, 3);

console.log('roster.test.js passed');
