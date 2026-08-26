const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClub, login, getSnapshot, putSnapshot, resetClub, addToRoster, updateRosterPlayer, removeFromRoster, listOnline } = require('./club.js');
const { loadClubData, saveClubData } = require('./club-store.js');

const PORT = Number(process.env.PORT || 8080);
const PIN = process.env.CLUB_PIN || '2026';
const ROOT = __dirname;
const boot = loadClubData();
const club = createClub(PIN, boot.roster);
club.state = boot.state;

function persist() {
  saveClubData(club);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function tokenOf(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function resolveStaticPath(root, urlPath) {
  const file = path.normalize(path.join(root, urlPath));
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (file !== root && !file.startsWith(prefix)) return null;
  return file;
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = resolveStaticPath(ROOT, urlPath);
  if (!file) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/login') {
      const body = await readBody(req);
      const result = login(club, body.name, body.pin);
      return send(res, result.ok ? 200 : 401, result);
    }
    if (req.method === 'GET' && req.url === '/api/state') {
      const result = getSnapshot(club, tokenOf(req));
      return send(res, result.ok ? 200 : result.status, result);
    }
    if (req.method === 'PUT' && req.url === '/api/state') {
      const body = await readBody(req);
      const result = putSnapshot(club, tokenOf(req), body);
      if (result.ok) persist();
      return send(res, result.ok ? 200 : result.status, result);
    }
    if (req.method === 'POST' && req.url === '/api/reset') {
      const result = resetClub(club, tokenOf(req));
      if (result.ok) persist();
      return send(res, result.ok ? 200 : result.status, result);
    }
    if (req.method === 'POST' && req.url === '/api/roster') {
      const token = tokenOf(req);
      const body = await readBody(req);
      let result;
      if (body.action === 'add') result = addToRoster(club, body.name, body.rating);
      else if (body.action === 'update') result = updateRosterPlayer(club, body.id, { name: body.name, rating: body.rating });
      else if (body.action === 'remove') result = removeFromRoster(club, body.id);
      else return send(res, 400, { ok: false, error: 'Unknown roster action' });
      if (!result.ok) return send(res, 400, result);
      persist();
      return send(res, 200, { ...result, online: listOnline(club) });
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    send(res, 404, 'Not found');
  } catch (err) {
    send(res, 400, { ok: false, error: 'Bad request' });
  }
});

function lanUrls() {
  const urls = [`http://127.0.0.1:${PORT}/`];
  try {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const addr of addrs || []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          urls.push(`http://${addr.address}:${PORT}/`);
        }
      }
    }
  } catch (err) {
    // ignore when network interfaces are unavailable
  }
  return urls;
}

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BadmintonPro club PIN: ${PIN}`);
    for (const url of lanUrls()) console.log(`  ${url}`);
  });
}

module.exports = { resolveStaticPath };
