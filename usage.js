const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DATA_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'SpicyPrompter'
);
const DATA_FILE = path.join(DATA_DIR, 'usage.json');
const DEMO_LIMIT = 200;

function _load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return null; }
}

function _save(data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data));
  } catch {}
}

function _ensure() {
  let d = _load();
  if (!d) { d = { id: crypto.randomUUID(), count: 0 }; _save(d); }
  return d;
}

function getCount() { return (_load() || { count: 0 }).count; }

function increment(n) {
  const d = _ensure();
  d.count += (n || 1);
  _save(d);
  return d.count;
}

function isAtLimit() { return getCount() >= DEMO_LIMIT; }

module.exports = { getCount, increment, isAtLimit, DEMO_LIMIT };
