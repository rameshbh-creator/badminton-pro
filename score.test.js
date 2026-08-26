const { validateMatchScore } = require('./score.js');
const assert = require('assert');

function fails(scoreA, scoreB, target, messagePart) {
  const result = validateMatchScore(scoreA, scoreB, target);
  assert.strictEqual(result.ok, false, `expected reject for ${scoreA}-${scoreB} to ${target}`);
  assert.ok(
    result.error && result.error.toLowerCase().includes(messagePart.toLowerCase()),
    `error "${result.error}" should mention "${messagePart}"`
  );
}

function ok(scoreA, scoreB, target, winner, stoppedEarly) {
  const result = validateMatchScore(scoreA, scoreB, target);
  assert.strictEqual(result.ok, true, result.error || `expected accept for ${scoreA}-${scoreB}`);
  assert.strictEqual(result.winner, winner);
  assert.strictEqual(result.scoreA, scoreA);
  assert.strictEqual(result.scoreB, scoreB);
  assert.strictEqual(result.stoppedEarly, stoppedEarly);
}

fails(undefined, 10, 21, 'valid');
fails(-1, 5, 21, 'valid');
fails(10, 10, 21, 'equal');
fails(22, 10, 21, '21');
fails(16, 8, 15, '15');

ok(21, 18, 21, 'A', false);
ok(14, 21, 21, 'B', false);
ok(21, 20, 21, 'A', false);
ok(15, 14, 15, 'A', false);

ok(8, 5, 21, 'A', true);
ok(12, 15, 21, 'B', true);
ok(8, 5, 15, 'A', true);
ok(0, 1, 15, 'B', true);

console.log('score.test.js passed');
