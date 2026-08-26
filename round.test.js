const assert = require('assert');
const { generateRound } = require('./round.js');

function makePlayers(n) {
  const map = {};
  for (let i = 1; i <= n; i++) {
    const id = `p${i}`;
    map[id] = { id, name: id, rating: 3, active: true, sessionPoints: n - i, wins: 0, roundsPlayed: 1, pointsScored: 0, pointsAgainst: 0 };
  }
  return map;
}

// Every active player must appear in exactly one of matches or bench each
// round — nobody should ever be dropped from the round entirely.
function assertNoPlayersLost(playerMap, round) {
  const total = Object.keys(playerMap).length;
  const playingIds = round.matches.flatMap(m => [...m.teamA, ...m.teamB]);
  const seen = new Set([...playingIds, ...round.bench]);
  assert.strictEqual(playingIds.length + round.bench.length, seen.size, 'a player id appeared more than once in the round');
  assert.strictEqual(seen.size, total, `expected all ${total} players accounted for, got ${seen.size}`);
}

// 12 players, 1 court: round 1 benches 8. Round 2's bench-rotation must not
// lose the players who were benched last round but can't all fit this round.
const players = makePlayers(12);
const round1 = generateRound(players, null, 1, true, []);
assertNoPlayersLost(players, round1);

const round2 = generateRound(players, round1, 1, false, [round1]);
assertNoPlayersLost(players, round2);

console.log('round.test.js passed');
