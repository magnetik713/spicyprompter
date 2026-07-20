const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

function getDataDir() {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'SpicyPrompter');
  }
  return path.join(os.homedir(), '.spicyprompter');
}

const DATA_DIR = process.env.NODE_ENV === 'test'
  ? __dirname
  : getDataDir();

if (process.env.NODE_ENV !== 'test') {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, 'test.db')
  : path.join(DATA_DIR, 'prompts.db');

// One-time migration: move DB from app folder to APPDATA on first run
if (process.env.NODE_ENV !== 'test') {
  const legacy = path.join(__dirname, 'prompts.db');
  if (!fs.existsSync(DB_PATH) && fs.existsSync(legacy)) {
    fs.copyFileSync(legacy, DB_PATH);
    const wal = legacy + '-wal';
    if (fs.existsSync(wal)) fs.copyFileSync(wal, DB_PATH + '-wal');
  }
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_url TEXT,
    dependencies TEXT,
    sampler TEXT,
    scheduler TEXT,
    steps INTEGER,
    cfg_scale REAL,
    denoise REAL,
    notes TEXT,
    workflow_json_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
    base_model TEXT,
    environment TEXT,
    scene TEXT,
    positive TEXT,
    negative TEXT,
    loras TEXT,
    trigger_words TEXT,
    tags TEXT,
    image_path TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);


// --- Migration system ---
// PRAGMA user_version is SQLite's built-in schema version counter.
// Add new migrations to the end of this array only — never edit existing ones.
const MIGRATIONS = [
  // 1 — columns added during early development
  () => {
    try { db.exec('ALTER TABLE prompts ADD COLUMN category TEXT DEFAULT NULL'); } catch (e) {}
    try { db.exec("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)"); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN starred INTEGER DEFAULT 0'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN seed INTEGER DEFAULT NULL'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN width INTEGER DEFAULT NULL'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN height INTEGER DEFAULT NULL'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN guidance REAL DEFAULT NULL'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN steps INTEGER DEFAULT NULL'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN cfg_scale REAL DEFAULT NULL'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN sampler TEXT DEFAULT NULL'); } catch (e) {}
    try { db.exec('ALTER TABLE prompts ADD COLUMN size_preset TEXT DEFAULT NULL'); } catch (e) {}
  },
];

function runMigrations() {
  const version = db.pragma('user_version', { simple: true });
  for (let i = version; i < MIGRATIONS.length; i++) {
    MIGRATIONS[i]();
    db.pragma('user_version = ' + (i + 1));
  }
}

runMigrations();


// llm_categories — create + seed on fresh install
try {
  db.exec(
    "CREATE TABLE IF NOT EXISTS llm_categories (" +
    "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "  name TEXT UNIQUE NOT NULL," +
    "  label TEXT NOT NULL," +
    "  subjects TEXT, settings TEXT, clothing TEXT," +
    "  styles TEXT, lighting TEXT," +
    "  emphasis TEXT NOT NULL," +
    "  type TEXT DEFAULT 'scene'," +
    "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
    "  updated_at DATETIME" +
    ")"
  );
  const count = db.prepare('SELECT COUNT(*) as n FROM llm_categories').get().n;
  if (count === 0) {
    const path = require('path');
    const fs = require('fs');
    const seedPath = path.join(__dirname, 'data', 'categories-seed.json');
    if (fs.existsSync(seedPath)) {
      const rows = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const ins = db.prepare(
        'INSERT OR IGNORE INTO llm_categories ' +
        '(name,label,subjects,settings,clothing,styles,lighting,emphasis,type) ' +
        'VALUES (?,?,?,?,?,?,?,?,?)'
      );
      const insertAll = db.transaction(function(rows) {
        for (const r of rows)
          ins.run(r.name, r.label, r.subjects||'', r.settings||'', r.clothing||'', r.styles||'', r.lighting||'', r.emphasis, r.type||'scene');
      });
      insertAll(rows);
    }
  }
} catch (e) { console.error('llm_categories init error:', e.message); }

module.exports = db;
