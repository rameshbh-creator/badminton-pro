function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function bestSplit(four, players, usedPairs) {
  // All 3 ways to split 4 players into 2 pairs
  const combos = [
    [[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]
  ];
  let best = null, bestDiff = Infinity, bestRepeats = Infinity;
  for (const [[a,b],[c,d]] of combos) {
    const idA1 = four[a], idA2 = four[b], idB1 = four[c], idB2 = four[d];
    const rA = players[idA1].rating + players[idA2].rating;
    const rB = players[idB1].rating + players[idB2].rating;
    const diff = Math.abs(rA - rB);
    // Count how many of these pairings were used before
    const repeats = (usedPairs.has(pairKey(idA1, idA2)) ? 1 : 0)
                  + (usedPairs.has(pairKey(idB1, idB2)) ? 1 : 0);
    // Prefer fewest repeated pairs first, then most balanced rating
    if (repeats < bestRepeats || (repeats === bestRepeats && diff < bestDiff)) {
      bestRepeats = repeats; bestDiff = diff;
      best = [[idA1, idA2], [idB1, idB2]];
    }
  }
  return best;
}

function generateRound(playerMap, prevRound, courtCount, isFirst, allPastRounds = []) {
  // Build set of all previous teammate pairings to avoid repeating
  const usedPairs = new Set();
  for (const round of allPastRounds) {
    for (const match of round.matches) {
      usedPairs.add(pairKey(match.teamA[0], match.teamA[1]));
      usedPairs.add(pairKey(match.teamB[0], match.teamB[1]));
    }
  }
  const allPlayers = Object.values(playerMap).filter(p => p.active !== false);
  const total = allPlayers.length;
  const activeCourts = Math.min(courtCount, Math.floor(total / 4));
  const playing = activeCourts * 4;

  // Sort by points/rating to establish rank order (this determines court assignment)
  const byRank = [...allPlayers].sort((a, b) =>
    isFirst
      ? b.rating - a.rating
      : b.sessionPoints - a.sessionPoints || b.wins - a.wins || b.rating - a.rating
  );

  let playingIds, bench;

  if (isFirst || !prevRound || prevRound.bench.length === 0) {
    // No bench rotation needed — top players by rank play, rest sit
    playingIds = byRank.slice(0, playing).map(p => p.id);
    bench = byRank.slice(playing).map(p => p.id);
  } else {
    // Bench rotation: players who sat last round must play this round if possible.
    // Swap them in for the lowest-ranked players who played last round.
    const prevBench = new Set(prevRound.bench);
    const mustPlay = byRank.filter(p => prevBench.has(p.id));       // sat last round
    const canSit   = byRank.filter(p => !prevBench.has(p.id));      // played last round

    // Fill spots: mustPlay first, then top of canSit to reach `playing` count.
    // mustPlay can exceed `playing` (e.g. fewer courts this round than
    // players owed a game) — in that case only the top `playing` of mustPlay
    // get in, and everyone else (including the rest of mustPlay) sits.
    const spotsLeft = playing - mustPlay.length;
    let playingPool, benchPool;
    if (spotsLeft >= 0) {
      const fromCanSit = canSit.slice(0, spotsLeft);                 // top scorers among those who played
      benchPool = canSit.slice(spotsLeft);                           // lowest scorers sit this round
      playingPool = [...mustPlay, ...fromCanSit];
    } else {
      playingPool = mustPlay.slice(0, playing);
      benchPool = [...mustPlay.slice(playing), ...canSit];
    }
    bench = benchPool.map(p => p.id);

    // Re-sort the playing pool by rank so Court 1 = highest pts
    playingPool = playingPool.sort((a, b) =>
      b.sessionPoints - a.sessionPoints || b.wins - a.wins || b.rating - a.rating
    );
    playingIds = playingPool.map(p => p.id);
  }

  // Assign courts: top 4 → Court 1, next 4 → Court 2, etc.
  const matches = [];
  for (let i = 0; i < activeCourts; i++) {
    const four = playingIds.slice(i * 4, i * 4 + 4);
    const [teamA, teamB] = bestSplit(four, playerMap, usedPairs);
    matches.push({ courtIndex: i, teamA, teamB, winner: null, scoreA: null, scoreB: null });
  }

  return { matches, bench };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pairKey, bestSplit, generateRound };
}
