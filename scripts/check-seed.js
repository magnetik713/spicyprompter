#!/usr/bin/env node
// Guards the two ways categories have silently gone missing from releases:
//   1. a category added to the local database but never added to the seed,
//      so it ships to nobody (this is how anime mode shipped empty)
//   2. a category name hardcoded in the code that the seed does not contain,
//      so the lookup silently resolves to nothing
// Run with `npm run check-seed`. Exits non-zero when either is true.

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const APP  = path.join(__dirname, '..');
const SEED = path.join(APP, 'data', 'categories-seed.json');

const dataDir = process.platform === 'win32' && process.env.APPDATA
  ? path.join(process.env.APPDATA, 'SpicyPrompter')
  : path.join(os.homedir(), '.spicyprompter');
const DB_PATH = path.join(dataDir, 'prompts.db');

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const seedNames = new Set(seed.map(r => r.name));
const seedByType = {};
for (const r of seed) (seedByType[r.type] = seedByType[r.type] || new Set()).add(r.name);

// Categories that exist locally on purpose and are not meant to ship.
// Keep the reason next to the name so this stays a decision, not a mystery.
const INTENTIONALLY_LOCAL = {
  futa:  'contradicts comfyui_neg_default, which negative-prompts "futa, futanari" out of every image',
  harem: 'product decision, not an oversight',
};

let failures = 0;
const fail = (msg) => { failures++; console.log('FAIL  ' + msg); };
const ok   = (msg) => console.log('ok    ' + msg);

// ---- 1. categories present locally but missing from the seed --------------
if (fs.existsSync(DB_PATH)) {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare('SELECT name, type FROM llm_categories').all();
  db.close();

  const localOnly = rows.filter(r => !seedNames.has(r.name));
  const held    = localOnly.filter(r => INTENTIONALLY_LOCAL[r.name]);
  const missing = localOnly.filter(r => !INTENTIONALLY_LOCAL[r.name]);

  if (missing.length) {
    const byType = {};
    for (const r of missing) (byType[r.type] = byType[r.type] || []).push(r.name);
    fail(`${missing.length} categories exist locally but are not in the seed, so they ship to nobody:`);
    for (const t of Object.keys(byType).sort())
      console.log(`        ${t.padEnd(16)} ${byType[t].sort().join(', ')}`);
    console.log('        Add them to data/categories-seed.json and bump SEED_VERSION in db.js,');
    console.log('        or list them in INTENTIONALLY_LOCAL with a reason.');
  } else {
    ok(`no unexplained local-only categories (${rows.length} local, ${seed.length} in seed)`);
  }
  for (const r of held) console.log(`held  ${r.name} - ${INTENTIONALLY_LOCAL[r.name]}`);

  // A category reclassified locally keeps its old type for everyone else,
  // because INSERT OR IGNORE never updates an existing row. Six categories
  // sat in the wrong picker for every user this way.
  const seedType = Object.fromEntries(seed.map(r => [r.name, r.type]));
  const retyped = rows.filter(r => seedType[r.name] && seedType[r.name] !== r.type);
  if (retyped.length) {
    fail(`${retyped.length} categories have a different type locally than the seed ships:`);
    for (const r of retyped.sort((a, b) => a.name.localeCompare(b.name)))
      console.log(`        ${r.name.padEnd(22)} seed=${seedType[r.name].padEnd(10)} local=${r.type}`);
    console.log('        Users keep whichever type they were first seeded with, so they see');
    console.log('        these in a different picker. Update the seed and add a one-time');
    console.log('        retype to the SEED_VERSION block in db.js.');
  } else {
    ok('no category type disagreements between seed and local database');
  }
} else {
  console.log('skip  no local database at ' + DB_PATH + ' - skipping drift check');
}

// ---- 2. hardcoded category names that the seed does not ship --------------
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const gen  = read('scripts/llm_generator.js');

const quoted = (block) => (block.match(/'[^']+'/g) || []).map(s => s.slice(1, -1));
const arrayOf = (src, name) => {
  const m = src.match(new RegExp(name + '\\s*=\\s*\\[([^\\]]*)\\]'));
  return m ? quoted(m[1]) : null;
};
const setOf = (src, name) => {
  const m = src.match(new RegExp(name + '\\s*=\\s*new Set\\(\\[([^\\]]*)\\]'));
  return m ? quoted(m[1]) : null;
};

const refs = [
  ['INTERRACIAL_DARK',     arrayOf(gen, 'INTERRACIAL_DARK'),  'race'],
  ['INTERRACIAL_LIGHT',    arrayOf(gen, 'INTERRACIAL_LIGHT'), 'race'],
  ['INTERRACIAL_MID',      arrayOf(gen, 'INTERRACIAL_MID'),   'race'],
  ['MALE_REQUIRED_THEMES', setOf(gen, 'MALE_REQUIRED_THEMES'), 'theme'],
];

for (const [label, names, type] of refs) {
  if (!names) { fail(`could not parse ${label} - this check needs updating`); continue; }
  const absent = names.filter(n => !seedNames.has(n));
  const wrongType = names.filter(n => seedNames.has(n) && !seedByType[type].has(n));
  if (absent.length)    fail(`${label} references categories not in the seed: ${absent.join(', ')}`);
  if (wrongType.length) fail(`${label} expects type '${type}' but these are not: ${wrongType.join(', ')}`);
  if (!absent.length && !wrongType.length) ok(`${label} (${names.length} names) all present as '${type}'`);
}

// ---- 3. every type the UI renders has something to render -----------------
for (const t of ['race', 'body_type', 'role', 'style', 'lighting', 'act', 'scene', 'theme', 'character_type']) {
  const n = seedByType[t] ? seedByType[t].size : 0;
  if (n === 0) fail(`seed ships 0 categories of type '${t}' - that picker renders empty`);
}
if (!failures) ok('every picker type has at least one seeded category');

console.log('');
console.log(failures ? `${failures} problem(s) found` : 'seed is consistent');
process.exit(failures ? 1 : 0);
