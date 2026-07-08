const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
// Add comfy_prompt_id column if not exists
try { db.prepare('ALTER TABLE prompts ADD COLUMN comfy_prompt_id TEXT').run(); } catch(e) {}

const cfg = require('../config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/images'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const PAGE_SIZE = 24;

router.get('/', async (req, res) => {
  // background license check — downgrades silently if revoked
  if (cfg.isPaid()) cfg.checkLicense().catch(() => {});
  const { tag, q, page, category, sort, starred } = req.query;
  const currentPage = Math.max(1, parseInt(page) || 1);
  const selectedTags = tag ? (Array.isArray(tag) ? tag : [tag]).filter(t => t && t !== 'All') : [];
  const selectedCategory = category || '';
  const selectedSort = ['newest','oldest','az','category'].includes(sort) ? sort : 'newest';
  const showStarred = starred === '1';

  const ORDER = {
    newest:   'p.created_at DESC',
    oldest:   'p.created_at ASC',
    az:       'p.positive ASC',
    category: 'p.category ASC, p.created_at DESC',
  }[selectedSort];

  let where = 'WHERE 1=1';
  const params = [];
  if (selectedTags.length > 0) {
    where += ' AND (' + selectedTags.map(() => 'p.tags LIKE ?').join(' AND ') + ')';
    selectedTags.forEach(t => params.push(`%${t}%`));
  }
  if (q) {
    where += ' AND (p.name LIKE ? OR p.tags LIKE ? OR p.positive LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (selectedCategory) {
    where += ' AND p.category = ?';
    params.push(selectedCategory);
  }
  if (showStarred) {
    where += ' AND p.starred = 1';
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM prompts p ${where}`).get(...params).n;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  const prompts = db.prepare(`
    SELECT p.* FROM prompts p
    ${where} ORDER BY ${ORDER} LIMIT ? OFFSET ?
  `).all(...params, PAGE_SIZE, offset);

  const categoryRows = db.prepare("SELECT DISTINCT category FROM prompts WHERE category IS NOT NULL AND category != '' ORDER BY category").all();
  const categories = categoryRows.map(r => r.category);

  const promptTotal = db.prepare('SELECT COUNT(*) as n FROM prompts').get().n;
  res.render('prompts/index', {
    prompts, categories,
    selectedTags, selectedCategory, selectedSort, showStarred, q: q || '',
    page: safePage, totalPages, total,
    promptTotal, paid: cfg.isPaid(),
    title: 'Prompt Library'
  });
});

router.post('/:id/star', (req, res) => {
  const row = db.prepare('SELECT starred FROM prompts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const newVal = row.starred ? 0 : 1;
  db.prepare('UPDATE prompts SET starred=? WHERE id=?').run(newVal, req.params.id);
  res.json({ starred: newVal });
});

router.get('/api/workflow/:id', (req, res) => {
  const wf = db.prepare('SELECT id, base_model FROM workflows WHERE id = ?').get(req.params.id);
  res.json(wf || {});
});

router.get('/api/loras', async (req, res) => {
  try {
    const comfyHost = cfg.get('comfyui_host') || 'localhost';
    const comfyPort = cfg.get('comfyui_port') || '8188';
    const r = await fetch(`http://${comfyHost}:${comfyPort}/object_info/LoraLoader`);
    const d = await r.json();
    res.json(d.LoraLoader?.input?.required?.lora_name?.[0] || []);
  } catch (e) {
    res.json([]);
  }
});

router.get('/new', (req, res) => {
  res.render('prompts/form', { prompt: {}, title: 'New Prompt', action: '/prompts', method: 'POST' });
});

router.post('/', upload.single('image'), (req, res) => {
  const { name, workflow_id, base_model, positive, negative, loras, trigger_words, tags, notes, seed, width, height, guidance, steps, cfg_scale, sampler } = req.body;
  const image_path = req.file ? `uploads/images/${req.file.filename}` : null;
  const result = db.prepare(`
    INSERT INTO prompts (name, workflow_id, base_model, positive, negative, loras, trigger_words, tags, image_path, notes, seed, width, height, guidance, steps, cfg_scale, sampler)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name || null, workflow_id || null, base_model || null, positive || null,
         negative || null, loras || null, trigger_words || null, tags || null, image_path, notes || null,
         seed || null, width || null, height || null, guidance || null, steps || null, cfg_scale || null, sampler || null);
  res.redirect(`/prompts/${result.lastInsertRowid}`);
});


// ── Generate ───────────────────────────────────────────────────────────────
const { spawn } = require('child_process');
const GENERATOR = require('path').join(__dirname, '../scripts/llm_generator.js');
const PROJ_DIR  = require('path').join(__dirname, '..');

router.get('/generate', (req, res) => { try {
  const raceCategories     = db.prepare("SELECT id,name,label FROM llm_categories WHERE type='race'      ORDER BY label").all();
  const styleCategories    = db.prepare("SELECT id,name,label FROM llm_categories WHERE type='style'     ORDER BY label").all();
  const bodyTypeCategories = db.prepare("SELECT id,name,label FROM llm_categories WHERE type='body_type' ORDER BY label").all();
  const roleCategories     = db.prepare("SELECT id,name,label FROM llm_categories WHERE type='role'      ORDER BY label").all();
  const actCategories      = db.prepare("SELECT id,name,label FROM llm_categories WHERE type='act'       ORDER BY label").all();
  const sceneCategories    = db.prepare("SELECT id,name,label FROM llm_categories WHERE type='scene'     ORDER BY label").all();
  const themeCategories    = db.prepare("SELECT id,name,label FROM llm_categories WHERE type='theme'     ORDER BY label").all();
  const defaultModel = cfg.get('llm_default_model') || '';
  const genPromptTotal = db.prepare('SELECT COUNT(*) as n FROM prompts').get().n;
  res.render('prompts/generate', { raceCategories, bodyTypeCategories, roleCategories, actCategories, sceneCategories, themeCategories, styleCategories, defaultModel, paid: cfg.isPaid(), promptTotal: genPromptTotal, title: 'Generate Prompts' });
  } catch(e) {
    res.status(500).send('<div style="font-family:sans-serif;padding:40px"><h2>Setup incomplete</h2><p>The database is not ready. Restart the server using <code>install.bat</code> and refresh this page.</p><pre style="color:red">' + e.message + '</pre></div>');
  }
});

router.get('/generate/run', async (req, res) => {
  const { cats, count, model, subject, race, bodytype, role, style } = req.query;

  if (!cfg.isPaid()) {
    const promptCount = db.prepare('SELECT COUNT(*) as n FROM prompts').get().n;
    if (promptCount >= 50) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write('data: ' + JSON.stringify({ type: 'limit', msg: 'Free tier limit reached (50 prompts). Purchase a license to generate unlimited prompts.' }) + '\n\n');
      return res.end();
    }
  }

  const safeCount   = Math.min(cfg.isPaid() ? 200 : 5, Math.max(1, parseInt(count) || 5));
  const safeModel   = (model || 'qwen3.6:35b-a3b').replace(/[^a-zA-Z0-9.:/@_-]/g, '');
  const safeCats    = (cats || '').replace(/[^a-zA-Z0-9_,]/g, '');
  const safeSubject = (subject || '').replace(/[^a-zA-Z0-9 _,-]/g, '').trim();
  const paid = cfg.isPaid();
  const safeCatsGated     = paid ? safeCats     : null;
  const safeRaceGated     = paid ? (race     || '').replace(/[^a-z_]/g, '') : '';
  const safeBodytypeGated = paid ? (bodytype || '').replace(/[^a-z_]/g, '') : '';
  const safeRoleGated     = paid ? (role     || '').replace(/[^a-z_]/g, '') : '';
  const safeStyleGated    = paid ? (style    || '').replace(/[^a-z_]/g, '') : '';

  if (cfg.isPaid()) {
    const valid = await cfg.checkLicense();
    if (!valid) {
      return res.status(403).json({ error: 'License revoked. Re-enter license key in Settings.' });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const llmUrl = cfg.get('llm_base_url');
  const llmKey = cfg.get('llm_api_key');
  const args = ['--count', String(safeCount), '--model', safeModel, '--url', llmUrl, '--key', llmKey];
  if (safeCatsGated)     args.push('--category', safeCatsGated);
  if (safeSubject)       args.push('--subject',  safeSubject);
  if (safeRaceGated)     args.push('--race',     safeRaceGated);
  if (safeBodytypeGated) args.push('--bodytype', safeBodytypeGated);
  if (safeRoleGated)     args.push('--role',     safeRoleGated);
  if (safeStyleGated)    args.push('--style',    safeStyleGated);

  const send = (data) => res.write('data: ' + JSON.stringify(data) + '\n\n');
  send({ type: 'start', args: args.join(' ') });

  const child = spawn(process.execPath, [GENERATOR, ...args], { cwd: PROJ_DIR });

  child.stdout.on('data', d => {
    d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'line', text: line }));
  });
  child.stderr.on('data', d => {
    d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'err', text: line }));
  });
  child.on('close', code => {
    send({ type: 'done', code });
    res.end();
  });

  req.on('close', () => child.kill());
});

// ── ComfyUI Integration ────────────────────────────────────────────────────
router.post('/api/comfyui/upload-workflow', (req, res) => {
  const multer = require('multer');
  const uploadDir = require('path').join(__dirname, '../uploads/workflows');
  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, file.originalname)
  });
  multer({ storage, fileFilter: (req, f, cb) => cb(null, f.originalname.endsWith('.json')) })
    .single('workflow')(req, res, (err) => {
      if (err || !req.file) return res.status(400).json({ error: err ? err.message : 'No file' });
      res.json({ filename: req.file.filename });
    });
});


router.get('/api/comfyui/models', async (req, res) => {
  const comfyHost = cfg.get('comfyui_host') || 'localhost';
  const comfyPort = cfg.get('comfyui_port') || '8188';
  try {
    const r = await fetch(`http://${comfyHost}:${comfyPort}/object_info/CheckpointLoaderSimple`);
    const data = await r.json();
    const models = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
    res.json(models);
  } catch (e) {
    res.json([]);
  }
});


router.get('/api/comfyui/workflows', (req, res) => {
  const fs = require('fs');
  const dir = require('path').join(__dirname, '../uploads/workflows');
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    res.json(files);
  } catch (e) { res.json([]); }
});

router.post('/api/comfyui/queue', async (req, res) => {
  const { prompt_text } = req.body;
  if (!prompt_text) return res.status(400).json({ error: 'prompt_text required' });

  const comfyHost    = cfg.get('comfyui_host')     || 'localhost';
  const comfyPort    = cfg.get('comfyui_port')     || '8188';
  const workflowFile = cfg.get('comfyui_workflow');
  if (!workflowFile) return res.status(400).json({ error: 'No workflow set. Configure one in Settings → ComfyUI.' });

  const fs2    = require('fs');
  const wfPath = require('path').join(__dirname, '../uploads/workflows', workflowFile);
  let workflow;
  try { workflow = JSON.parse(fs2.readFileSync(wfPath, 'utf8')); }
  catch (e) { return res.status(400).json({ error: `Workflow file not found: ${workflowFile}` }); }

  // Find target node: configured ID or first CLIPTextEncode
  let nodeId = cfg.get('comfyui_node_id') || '';
  if (!nodeId) {
    for (const [id, node] of Object.entries(workflow)) {
      if (node.class_type === 'CLIPTextEncode') { nodeId = id; break; }
    }
  }
  if (!nodeId || !workflow[nodeId]) {
    return res.status(400).json({ error: `Prompt node not found. Set Node ID in Settings.` });
  }

  workflow[nodeId].inputs.text = prompt_text;

  // Inject model name if configured
  const modelName = cfg.get('comfyui_model') || '';
  if (modelName) {
    for (const node of Object.values(workflow)) {
      if (node.class_type === 'CheckpointLoaderSimple') { node.inputs.ckpt_name = modelName; break; }
      if (node.class_type === 'UNETLoader') { node.inputs.unet_name = modelName; break; }
    }
  }

  try {
    const r = await fetch(`http://${comfyHost}:${comfyPort}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });
    if (!r.ok) throw new Error(`ComfyUI ${r.status}: ${await r.text()}`);
    const data = await r.json();
    // Store ComfyUI prompt_id so polling can resume after page navigation
    if (req.body.prompt_db_id) {
      db.prepare('UPDATE prompts SET comfy_prompt_id=? WHERE id=?').run(data.prompt_id, req.body.prompt_db_id);
    }
    res.json({ ok: true, prompt_id: data.prompt_id, number: data.number });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.post('/api/comfyui/fetch-image', async (req, res) => {
  const { prompt_db_id, filename } = req.body;
  if (!prompt_db_id || !filename) return res.status(400).json({ error: 'prompt_db_id and filename required' });

  const comfyHost = cfg.get('comfyui_host') || 'localhost';
  const comfyPort = cfg.get('comfyui_port') || '8188';
  const url = `http://${comfyHost}:${comfyPort}/view?filename=${encodeURIComponent(filename)}`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`ComfyUI /view returned ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const saveName = `${Date.now()}-comfy-${filename}`;
    const savePath = path.join(__dirname, '../uploads/images', saveName);
    require('fs').writeFileSync(savePath, buf);
    const image_path = `uploads/images/${saveName}`;

    // Pull seed + dimensions from ComfyUI history
    let seed = null, width = null, height = null;
    try {
      const promptRow = db.prepare('SELECT comfy_prompt_id FROM prompts WHERE id=?').get(prompt_db_id);
      const comfyId = promptRow && promptRow.comfy_prompt_id;
      if (comfyId) {
        const hr = await fetch(`http://${comfyHost}:${comfyPort}/history/${comfyId}`);
        const h = await hr.json();
        const job = h[comfyId];
        if (job) {
          const nodes = (job.prompt && job.prompt[2]) || {};
          for (const n of Object.values(nodes)) {
            const inp = n.inputs || {};
            if (inp.seed != null) { seed = inp.seed; }
            if (inp.width && inp.height) { width = inp.width; height = inp.height; }
          }
        }
      }
    } catch (e) { /* non-fatal */ }

    db.prepare(
      'UPDATE prompts SET image_path=?, seed=?, width=?, height=?, comfy_prompt_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(image_path, seed, width, height, prompt_db_id);

    res.json({ ok: true, image_url: '/prompts/' + image_path, seed, width, height });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});


router.get('/api/comfyui/status', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  const comfyHost = cfg.get('comfyui_host') || 'localhost';
  const comfyPort = cfg.get('comfyui_port') || '8188';
  try {
    const qr = await fetch(`http://${comfyHost}:${comfyPort}/queue`);
    const q  = await qr.json();
    const running = (q.queue_running || []).some(item => item[1] === id);
    const pending = (q.queue_pending || []).some(item => item[1] === id);
    if (running) return res.json({ status: 'running' });
    if (pending) return res.json({ status: 'pending' });

    const hr = await fetch(`http://${comfyHost}:${comfyPort}/history/${id}`);
    const h  = await hr.json();
    if (h[id]) {
      const job = h[id];
      const imgs = Object.values(job.outputs || {}).flatMap(o => o.images || []);
      const filename = imgs[0]?.filename || '';
      if (job.status?.completed) return res.json({ status: 'done', filename });
      return res.json({ status: 'error' });
    }
    return res.json({ status: 'unknown' });
  } catch (e) { res.status(502).json({ error: e.message }); }
});



router.post('/api/prompts/texts', (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.json([]);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare('SELECT id, positive, image_path FROM prompts WHERE id IN (' + placeholders + ')').all(...ids);
  res.json(rows);
});

router.post('/api/export', (req, res) => {
  const { ids, format } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'no ids' });
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, positive, negative, tags, created_at FROM prompts WHERE id IN (${placeholders})`).all(...ids);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="spicyprompter-export.json"');
    return res.send(JSON.stringify(rows, null, 2));
  }

  if (format === 'txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="spicyprompter-export.txt"');
    return res.send(rows.map(r => r.positive || '').join('\n\n'));
  }

  // CSV
  const escape = v => '"' + String(v || '').replace(/"/g, '""') + '"';
  const header = 'id,positive,negative,tags,created_at';
  const lines = rows.map(r => [r.id, r.positive, r.negative, r.tags, r.created_at].map(escape).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="spicyprompter-export.csv"');
  res.send([header, ...lines].join('\n'));
});


router.get('/api/comfyui/pending', (req, res) => {
  const rows = db.prepare(
    "SELECT id, comfy_prompt_id FROM prompts WHERE comfy_prompt_id IS NOT NULL AND (image_path IS NULL OR image_path = '')"
  ).all();
  res.json(rows);
});


router.get('/api/recent', (req, res) => {
  const n = Math.min(200, Math.max(1, parseInt(req.query.n) || 20));
  const rows = db.prepare('SELECT id, positive FROM prompts ORDER BY created_at DESC LIMIT ?').all(n);
  res.json(rows);
});


// ── Category Admin ─────────────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM llm_categories ORDER BY name').all();
  res.render('prompts/categories', { categories, title: 'Prompt Categories', paid: cfg.isPaid(), query: req.query });
});

router.get('/categories/new', (req, res) => {
  if (!cfg.isPaid()) return res.redirect('/prompts/categories?locked=1');
  res.render('prompts/category-form', { cat: {}, title: 'New Category' });
});

router.post('/categories', (req, res) => {
  if (!cfg.isPaid()) return res.redirect('/prompts/categories?locked=1');
  const { name, label, subjects, settings, clothing, styles, lighting, emphasis } = req.body;
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  db.prepare(`INSERT OR REPLACE INTO llm_categories (name, label, subjects, settings, clothing, styles, lighting, emphasis)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(slug, label, subjects || null, settings || null, clothing || null, styles || null, lighting || null, emphasis);
  res.redirect('/prompts/categories');
});

router.post('/categories/:id/delete', (req, res) => {
  if (!cfg.isPaid()) return res.redirect('/prompts/categories?locked=1');
  db.prepare('DELETE FROM llm_categories WHERE id = ?').run(req.params.id);
  res.redirect('/prompts/categories');
});

router.get('/categories/:id/edit', (req, res) => {
  if (!cfg.isPaid()) return res.redirect('/prompts/categories?locked=1');
  const cat = db.prepare('SELECT * FROM llm_categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).send('Not found');
  res.render('prompts/category-form', { cat, title: `Edit ${cat.label}` });
});

router.post('/categories/:id', (req, res) => {
  const { label, subjects, settings, clothing, styles, lighting, emphasis } = req.body;
  db.prepare(`UPDATE llm_categories SET label=?, subjects=?, settings=?, clothing=?, styles=?, lighting=?, emphasis=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(label, subjects || null, settings || null, clothing || null, styles || null, lighting || null, emphasis, req.params.id);
  res.redirect('/prompts/categories');
});


router.get('/:id/edit', (req, res) => {
  const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!prompt) return res.status(404).render('404', { title: 'Not Found' });
  res.render('prompts/form', { prompt, title: `Edit ${prompt.name}`, action: `/prompts/${prompt.id}?_method=PUT`, method: 'POST' });
});

router.get('/:id', (req, res) => {
  const prompt = db.prepare(`
    SELECT p.*, w.name AS workflow_name
    FROM prompts p LEFT JOIN workflows w ON p.workflow_id = w.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!prompt) return res.status(404).render('404', { title: 'Not Found' });
  res.render('prompts/detail', { prompt, title: prompt.name });
});

router.put('/:id', upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).render('404', { title: 'Not Found' });
  const { name, workflow_id, base_model, positive, negative, loras, trigger_words, tags, notes, seed, width, height, guidance, steps, cfg_scale, sampler } = req.body;
  const image_path = req.file ? `uploads/images/${req.file.filename}` : existing.image_path;
  db.prepare(`
    UPDATE prompts SET name=?, workflow_id=?, base_model=?, positive=?,
    negative=?, loras=?, trigger_words=?, tags=?, image_path=?, notes=?,
    seed=?, width=?, height=?, guidance=?, steps=?, cfg_scale=?, sampler=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name || null, workflow_id || null, base_model || null, positive || null,
         negative || null, loras || null, trigger_words || null, tags || null,
         image_path, notes || null,
         seed || null, width || null, height || null, guidance || null, steps || null, cfg_scale || null, sampler || null,
         req.params.id);
  res.redirect(`/prompts/${req.params.id}`);
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM prompts WHERE id = ?').run(req.params.id);
  res.redirect('/prompts');
});


router.post("/batch-delete", (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    db.prepare("DELETE FROM prompts WHERE id IN (" + placeholders + ")").run(...ids);
  }
  res.redirect("/prompts?" + new URLSearchParams(req.body._back || "").toString());
});


module.exports = router;
