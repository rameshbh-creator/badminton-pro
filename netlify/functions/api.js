const { connectLambda, getStore } = require('@netlify/blobs');
const {
  login,
  getSnapshot,
  putSnapshot,
  resetClub,
  addToRoster,
  updateRosterPlayer,
  removeFromRoster,
  listOnline,
} = require('../../club.js');
const { serializeClub, hydrateClub } = require('../../club-persist.js');

const PIN = process.env.CLUB_PIN || '2026';
const STORE_NAME = 'badminton-club';
const STORE_KEY = 'club';

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

function tokenOf(event) {
  const headers = event.headers || {};
  const bearer = headers.authorization || headers.Authorization || '';
  if (bearer.startsWith('Bearer ')) return bearer.slice(7);
  return String(headers['x-club-token'] || headers['X-Club-Token'] || '');
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return raw ? JSON.parse(raw) : {};
}

function apiRoute(event) {
  const raw = event.rawUrl || event.path || '';
  try {
    const pathname = raw.startsWith('http') ? new URL(raw).pathname : raw.split('?')[0];
    if (pathname.startsWith('/api/')) return pathname.slice(5);
    if (pathname.startsWith('/.netlify/functions/api/')) return pathname.slice('/.netlify/functions/api/'.length);
  } catch (_) {}
  return '';
}

async function loadClub() {
  const store = getStore(STORE_NAME);
  const data = await store.get(STORE_KEY, { type: 'json' });
  return hydrateClub(PIN, data);
}

async function saveClub(club) {
  const store = getStore(STORE_NAME);
  await store.setJSON(STORE_KEY, serializeClub(club));
}

exports.handler = async (event) => {
  try {
    connectLambda(event);
    const route = apiRoute(event);
    const club = await loadClub();

    if (event.httpMethod === 'POST' && route === 'login') {
      const body = parseBody(event);
      const result = login(club, body.name, body.pin);
      if (result.ok) await saveClub(club);
      return json(result.ok ? 200 : 401, result);
    }

    if (event.httpMethod === 'GET' && route === 'state') {
      const result = getSnapshot(club, tokenOf(event));
      if (result.ok) await saveClub(club);
      return json(result.ok ? 200 : result.status, result);
    }

    if (event.httpMethod === 'PUT' && route === 'state') {
      const body = parseBody(event);
      const result = putSnapshot(club, tokenOf(event), body);
      if (result.ok) await saveClub(club);
      return json(result.ok ? 200 : result.status, result);
    }

    if (event.httpMethod === 'POST' && route === 'reset') {
      const result = resetClub(club, tokenOf(event));
      if (result.ok) await saveClub(club);
      return json(result.ok ? 200 : result.status, result);
    }

    if (event.httpMethod === 'POST' && route === 'roster') {
      const token = tokenOf(event);
      if (!club.tokens.get(token)) {
        return json(401, { ok: false, error: 'Login required' });
      }
      const body = parseBody(event);
      let result;
      if (body.action === 'add') result = addToRoster(club, body.name, body.rating);
      else if (body.action === 'update') result = updateRosterPlayer(club, body.id, { name: body.name, rating: body.rating });
      else if (body.action === 'remove') result = removeFromRoster(club, body.id);
      else return json(400, { ok: false, error: 'Unknown roster action' });
      if (!result.ok) return json(400, result);
      club.tokens.get(token).lastSeen = Date.now();
      await saveClub(club);
      return json(200, { ...result, online: listOnline(club) });
    }

    return json(404, { ok: false, error: 'Not found' });
  } catch (err) {
    console.error('api error', err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
