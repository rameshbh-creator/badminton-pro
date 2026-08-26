const { createClub, emptyState, normalizeRosterEntry } = require('./club.js');

function serializeClub(club) {
  return {
    state: club.state,
    roster: club.roster,
    tokens: [...club.tokens.entries()],
  };
}

function hydrateClub(pin, data) {
  const club = createClub(pin, Array.isArray(data?.roster) ? data.roster : []);
  club.state = { ...emptyState(), ...(data?.state || {}) };
  club.roster = club.roster.map(normalizeRosterEntry).filter(Boolean);
  club.tokens = new Map(Array.isArray(data?.tokens) ? data.tokens : []);
  return club;
}

module.exports = { serializeClub, hydrateClub };
