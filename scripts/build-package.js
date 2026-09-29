// Builds the release zip.
//
// Source of truth is `git archive HEAD` — TRACKED FILES ONLY. The previous
// version globbed the working directory with a denylist, which silently swept
// in whatever happened to be lying around: comfy-prompts.db, config.db,
// data/prompts.db, four .bak files, tests/, and 40MB of marketing .mp4s. A
// denylist only excludes what someone remembered to name; a new stray file is
// included by default, and for a public download that is the wrong default.
//
// Anything not committed is not shipped. Files that are committed but are for
// development only are named in DEV_ONLY below. The build then audits its own
// output and refuses to write the zip if anything sensitive slipped through.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

// Committed, but never shipped to users.
const DEV_ONLY = [
  'adapt.mp4', 'demo.mp4', 'lora.mp4',          // marketing, ~40MB
  'ecosystem.config.js',                         // PM2 config, local paths
  '.gitignore', '.gitattributes',
  'routes/imagegen.js',                          // not part of the product
  'tests/',
  'scripts/build-package.js',
  'scripts/categories.js',
  'scripts/check-seed.js',                       // dev consistency checker
  'scripts/civitai_scraper.js',
  'scripts/clean-pony-tags.js',
  'scripts/import-civitai-flux.js',
  'scripts/import-civitai-nsfw.js',
  'scripts/import-civitai-red.js',
];

// Untracked, but deliberately shipped: the two starter workflows.
const EXTRA_SHIP = [
  'uploads/workflows/sd15-standard-t2i.json',
  'uploads/workflows/sdxl-standard-t2i.json',
];

// If any of these match the staged tree, the build fails rather than ships.
const FORBIDDEN_NAMES = [
  /\.db$/, /\.db-(shm|wal)$/, /\.bak$/, /\.log$/, /(^|\/)\.env/,
  /\.pem$/, /\.key$/, /(^|\/)id_(rsa|ed25519)/,
  /(^|\/)uploads\/images\//, /(^|\/)uploads\/workflows\/generated\//,
];
const FORBIDDEN_CONTENT = [
  [/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/, 'GitHub token'],
  [/sk-[A-Za-z0-9]{20,}/, 'API key'],
  [/-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/, 'private key'],
  [/192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+/, 'private IP address'],
];
const TEXT_EXT = /\.(js|ejs|json|md|css|bat|txt|html|yml|yaml)$/i;

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-release-'));
const outFile = path.join(ROOT, '..', `spicyprompter-v${version}.zip`);

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], ...opts });
}

// refuse to package uncommitted work: the zip would not match the tag
const dirty = sh('git', ['status', '--porcelain', '--untracked-files=no']).toString().trim();
if (dirty && !process.argv.includes('--allow-dirty')) {
  console.error('Refusing to build: uncommitted changes to tracked files.\n' + dirty);
  console.error('Commit them, or pass --allow-dirty for a test build.');
  process.exit(1);
}

sh('sh', ['-c', `git archive HEAD | tar -x -C "${stage}"`]);

for (const rel of DEV_ONLY) {
  fs.rmSync(path.join(stage, rel), { recursive: true, force: true });
}
for (const rel of EXTRA_SHIP) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) { console.error(`Missing file that must ship: ${rel}`); process.exit(1); }
  fs.mkdirSync(path.join(stage, path.dirname(rel)), { recursive: true });
  fs.copyFileSync(src, path.join(stage, rel));
}

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const files = walk(stage);
const problems = [];

for (const rel of files) {
  for (const re of FORBIDDEN_NAMES) {
    if (re.test(rel)) problems.push(`${rel}: matches forbidden pattern ${re}`);
  }
  if (!TEXT_EXT.test(rel)) continue;
  const body = fs.readFileSync(path.join(stage, rel), 'utf8');
  for (const [re, label] of FORBIDDEN_CONTENT) {
    const m = body.match(re);
    if (m) problems.push(`${rel}: contains a ${label} (${m[0].slice(0, 12)}...)`);
  }
}

if (problems.length) {
  console.error('Refusing to build — the staged release contains:');
  for (const p of problems) console.error('  ' + p);
  fs.rmSync(stage, { recursive: true, force: true });
  process.exit(1);
}

fs.rmSync(outFile, { force: true });
sh('sh', ['-c', `cd "${stage}" && zip -qr "${outFile}" .`]);
fs.rmSync(stage, { recursive: true, force: true });

const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
console.log(`Built: ${path.basename(outFile)} (${mb} MB, ${files.length} files)`);
console.log(`Path:  ${outFile}`);
console.log('Audit: no databases, keys, private IPs or dev-only files.');
