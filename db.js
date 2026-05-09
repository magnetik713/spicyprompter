const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, 'test.db')
  : path.join(__dirname, 'prompts.db');

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

module.exports = db;
