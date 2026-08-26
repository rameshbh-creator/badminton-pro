function validateMatchScore(scoreA, scoreB, target) {
  const a = Number(scoreA);
  const b = Number(scoreB);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return { ok: false, error: 'Enter valid scores' };
  }
  if (a === b) {
    return { ok: false, error: 'Scores cannot be equal — leader takes the game' };
  }
  if (a > target || b > target) {
    return { ok: false, error: `Score cannot exceed ${target}` };
  }
  const winner = a > b ? 'A' : 'B';
  const stoppedEarly = Math.max(a, b) < target;
  return { ok: true, winner, scoreA: a, scoreB: b, stoppedEarly };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateMatchScore };
}
