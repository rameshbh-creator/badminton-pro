const assert = require('assert');
const Module = require('module');
const path = require('path');

// In-memory blob store so we can exercise the Netlify handler without Netlify CLI.
const blobData = new Map();
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@netlify/blobs') {
    return {
      connectLambda() {},
      getStore() {
        return {
          async get(key, { type } = {}) {
            const value = blobData.get(key);
            if (value == null) return null;
            return type === 'json' ? JSON.parse(value) : value;
          },
          async setJSON(key, value) {
            blobData.set(key, JSON.stringify(value));
          },
        };
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { handler } = require('./netlify/functions/api.js');

function parse(res) {
  return { status: res.statusCode, data: JSON.parse(res.body) };
}

async function call(method, route, { body, token } = {}) {
  return parse(await handler({
    httpMethod: method,
    rawUrl: `https://badmintonmatchup.netlify.app/api/${route}`,
    path: `/api/${route}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  }));
}

(async () => {
  blobData.clear();

  const badPin = await call('POST', 'login', { body: { name: 'Ramesh', pin: '0000' } });
  assert.strictEqual(badPin.status, 401);
  assert.strictEqual(badPin.data.ok, false);

  const login = await call('POST', 'login', { body: { name: 'Ramesh', pin: '2026' } });
  assert.strictEqual(login.status, 200);
  assert.strictEqual(login.data.ok, true);
  assert.ok(login.data.token);

  const noAuth = await call('GET', 'state');
  assert.strictEqual(noAuth.status, 401);

  const snap = await call('GET', 'state', { token: login.data.token });
  assert.strictEqual(snap.status, 200);
  assert.strictEqual(snap.data.state.screen, 'setup');

  const rosterDenied = await call('POST', 'roster', {
    body: { action: 'add', name: 'Ajay', rating: 4 },
  });
  assert.strictEqual(rosterDenied.status, 401);

  const rosterAdd = await call('POST', 'roster', {
    token: login.data.token,
    body: { action: 'add', name: 'Ajay', rating: 4 },
  });
  assert.strictEqual(rosterAdd.status, 200);
  assert.strictEqual(rosterAdd.data.roster.length, 1);

  // Token must survive a cold start (new handler invocation, empty module cache is fine —
  // persistence is what matters).
  const snapAgain = await call('GET', 'state', { token: login.data.token });
  assert.strictEqual(snapAgain.status, 200);
  assert.strictEqual(snapAgain.data.roster.length, 1);

  console.log('netlify-api.test.js passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
