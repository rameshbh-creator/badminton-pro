const crypto = require('crypto');

function emptyState() {
  return {
    rev: 0,
    screen: 'setup',
    courts: 2,
    scoreTarget: 21,
    players: [],
    playerMap: null,
    rounds: [],
    currentRound: null,
    roundNum: 1,
    finalMap: null,
    roundsPlayed: 0,
  };
}

function createClub(pin, savedRoster = []) {
  return {
    pin: String(pin),
    tokens: new Map(),
    state: emptyState(),
    roster: savedRoster.map(normalizeRosterEntry).filter(Boolean),
  };
}

function normalizeHistoryEntry(h) {
  if (!h) return null;
  return {
    date: String(h.date || new Date().toISOString().slice(0, 10)),
    sessionPoints: Math.max(0, Number(h.sessionPoints) || 0),
    wins: Math.max(0, Number(h.wins) || 0),
    roundsPlayed: Math.max(0, Number(h.roundsPlayed) || 0),
    roundsOnBench: Math.max(0, Number(h.roundsOnBench) || 0),
    pointsScored: Math.max(0, Number(h.pointsScored) || 0),
    pointsAgainst: Math.max(0, Number(h.pointsAgainst) || 0),
  };
}

function normalizeRosterEntry(p) {
  if (!p || !String(p.name || '').trim()) return null;
  return {
    id: p.id || `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: String(p.name).trim(),
    rating: Math.min(5, Math.max(1, Number(p.rating) || 3)),
    totalPoints: Math.max(0, Number(p.totalPoints) || 0),
    sessionsPlayed: Math.max(0, Number(p.sessionsPlayed) || 0),
    history: Array.isArray(p.history) ? p.history.map(normalizeHistoryEntry).filter(Boolean) : [],
  };
}

function findRosterByName(club, name) {
  const key = String(name || '').trim().toLowerCase();
  return club.roster.find(p => p.name.toLowerCase() === key);
}

function addToRoster(club, name, rating) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: 'Enter a player name' };
  const existing = findRosterByName(club, trimmed);
  if (existing) {
    existing.rating = Math.min(5, Math.max(1, Number(rating) || existing.rating));
    return { ok: true, roster: club.roster, player: existing };
  }
  const player = normalizeRosterEntry({ id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: trimmed, rating });
  club.roster.push(player);
  return { ok: true, roster: club.roster, player };
}

function updateRosterPlayer(club, id, patch) {
  const player = club.roster.find(p => p.id === id);
  if (!player) return { ok: false, error: 'Player not found' };
  if (patch.name !== undefined) {
    const trimmed = String(patch.name).trim();
    if (!trimmed) return { ok: false, error: 'Enter a player name' };
    const clash = findRosterByName(club, trimmed);
    if (clash && clash.id !== id) return { ok: false, error: 'Name already saved' };
    player.name = trimmed;
  }
  if (patch.rating !== undefined) {
    player.rating = Math.min(5, Math.max(1, Number(patch.rating) || player.rating));
  }
  return { ok: true, roster: club.roster, player };
}

function removeFromRoster(club, id) {
  const before = club.roster.length;
  club.roster = club.roster.filter(p => p.id !== id);
  if (club.roster.length === before) return { ok: false, error: 'Player not found' };
  return { ok: true, roster: club.roster };
}

function recordSessionResults(club, finalMap, roundsPlayed = 0) {
  const entries = Object.values(finalMap || {});
  if (!entries.length) return { ok: false, error: 'No session results' };
  const date = new Date().toISOString().slice(0, 10);
  for (const result of entries) {
    const player = club.roster.find(p => p.id === result.id);
    if (!player) continue;
    const sessionPoints = Math.max(0, Number(result.sessionPoints) || 0);
    player.history.unshift(normalizeHistoryEntry({
      date,
      sessionPoints,
      wins: result.wins,
      roundsPlayed: result.roundsPlayed,
      roundsOnBench: result.roundsOnBench,
      pointsScored: result.pointsScored,
      pointsAgainst: result.pointsAgainst,
    }));
    if (player.history.length > 20) player.history.length = 20;
    player.totalPoints += sessionPoints;
    player.sessionsPlayed += 1;
  }
  return { ok: true, roster: club.roster };
}

function login(club, name, pin) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: 'Enter your name' };
  if (String(pin) !== club.pin) return { ok: false, error: 'Wrong club PIN' };
  const token = crypto.randomBytes(16).toString('hex');
  club.tokens.set(token, { name: trimmed, lastSeen: Date.now() });
  return { ok: true, token, name: trimmed };
}

function requireUser(club, token) {
  const user = club.tokens.get(token);
  if (!user) return null;
  user.lastSeen = Date.now();
  return user;
}

function listOnline(club, maxAgeMs = 20000) {
  const now = Date.now();
  const names = [];
  for (const user of club.tokens.values()) {
    if (now - user.lastSeen <= maxAgeMs) names.push(user.name);
  }
  return [...new Set(names)];
}

function getSnapshot(club, token) {
  if (!requireUser(club, token)) return { ok: false, status: 401, error: 'Login required' };
  return { ok: true, state: club.state, roster: club.roster, online: listOnline(club) };
}

function putSnapshot(club, token, body) {
  if (!requireUser(club, token)) return { ok: false, status: 401, error: 'Login required' };
  if (!body || body.rev !== club.state.rev) {
    return { ok: false, status: 409, error: 'Session updated elsewhere', state: club.state, roster: club.roster, online: listOnline(club) };
  }
  // historySaved is a server-owned flag: a client must never be able to set
  // it, or a forged PUT could replay the summary transition and double-award
  // roster points.
  const { historySaved: _clientHistorySaved, ...clientBody } = body;
  const next = { ...club.state, ...clientBody, rev: club.state.rev + 1, historySaved: club.state.historySaved };
  if (club.state.screen !== 'summary' && next.screen === 'summary' && next.finalMap && !next.historySaved) {
    recordSessionResults(club, next.finalMap, next.roundsPlayed || 0);
    next.historySaved = true;
  }
  club.state = next;
  return { ok: true, state: club.state, roster: club.roster, online: listOnline(club) };
}

function resetClub(club, token) {
  if (!requireUser(club, token)) return { ok: false, status: 401, error: 'Login required' };
  // rev must keep climbing across a reset — clients discard any server
  // state whose rev is lower than what they last saw.
  club.state = { ...emptyState(), rev: club.state.rev + 1 };
  return { ok: true, state: club.state, roster: club.roster, online: listOnline(club) };
}

module.exports = {
  createClub,
  emptyState,
  login,
  getSnapshot,
  putSnapshot,
  resetClub,
  listOnline,
  addToRoster,
  updateRosterPlayer,
  removeFromRoster,
  recordSessionResults,
  normalizeRosterEntry,
};
