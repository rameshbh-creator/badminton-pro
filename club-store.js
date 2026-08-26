const fs = require('fs');
const path = require('path');
const { emptyState, normalizeRosterEntry } = require('./club.js');

const DATA_FILE = path.join(__dirname, 'club-data.json');

function loadClubData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      state: { ...emptyState(), ...(data.state || {}) },
      roster: Array.isArray(data.roster) ? data.roster.map(normalizeRosterEntry).filter(Boolean) : [],
    };
  } catch (err) {
    return { state: emptyState(), roster: [] };
  }
}

function saveClubData(club) {
  const payload = {
    state: club.state,
    roster: club.roster,
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
}

module.exports = { loadClubData, saveClubData, DATA_FILE };
