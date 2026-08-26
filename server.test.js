const assert = require('assert');
const path = require('path');
const { resolveStaticPath } = require('./server.js');

const root = path.join(path.sep, 'srv', 'badminton-pro');

// Normal in-root file resolves fine.
assert.strictEqual(resolveStaticPath(root, '/index.html'), path.join(root, 'index.html'));

// A sibling directory that merely shares ROOT as a string prefix must be
// rejected — it is not inside ROOT. Mirrors how a real request URL
// (leading '/') gets path.join'd onto ROOT in resolveStaticPath.
assert.strictEqual(
  resolveStaticPath(root, '/../badminton-pro-backup/club-data.json'),
  null,
  'sibling directory sharing ROOT as a string prefix must be rejected'
);

// A classic ../ escape out of ROOT must also be rejected.
assert.strictEqual(resolveStaticPath(root, '/../../etc/passwd'), null);

console.log('server.test.js passed');
