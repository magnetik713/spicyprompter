const { ZipArchive } = require('archiver');
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = pkg.version;
const outFile = path.join(__dirname, `../../SpicyPrompter-v${version}.zip`);

if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

const output = fs.createWriteStream(outFile);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  const mb = (archive.pointer() / 1024 / 1024).toFixed(1);
  console.log(`Built: ${path.basename(outFile)} (${mb} MB)`);
  console.log(`Path:  ${outFile}`);
});
archive.on('error', err => { throw err; });
archive.pipe(output);

archive.glob('**/*', {
  cwd: path.join(__dirname, '..'),
  ignore: [
    'node_modules/**',
    'prompts.db',
    'prompts.db-shm',
    'prompts.db-wal',
    'routes/imagegen.js',
    'uploads/images/**',
    // only sd15 and sdxl ship; exclude everything else in workflows/
    'uploads/workflows/krea2-t2i.json',
    'uploads/workflows/1778291659531-*.json',
    'uploads/workflows/1778292133183-*.json',
    'uploads/workflows/1778292327234-*.json',
    'scripts/build-package.js',
  ],
  dot: false
});

archive.finalize();
