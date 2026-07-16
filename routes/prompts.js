const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
// Add comfy_prompt_id column if not exists
try { db.prepare('ALTER TABLE prompts ADD COLUMN comfy_prompt_id TEXT').run(); } catch(e) {}
try { db.prepare('ALTER TABLE workflows ADD COLUMN guidance REAL').run(); } catch(e) {}
try { db.prepare('ALTER TABLE prompts ADD COLUMN workflow_json_path TEXT').run(); } catch(e) {}

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
  const selectedSort = ['newest','oldest','az','category','starred'].includes(sort) ? sort : 'newest';
  const showStarred = starred === '1';

  const ORDER = {
    newest:   'p.created_at DESC',
    oldest:   'p.created_at ASC',
    az:       'p.positive ASC',
    category: 'p.category ASC, p.created_at DESC',
    starred:  'p.starred DESC, p.created_at DESC',
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


// Demo-mode allowed values per filter
const DEMO_ALLOWED = {
  race:     new Set(['asian','ebony','latina','russian','french','scandinavian','brazilian','italian','korean','indian','persian']),
  bodytype: new Set(['athletic','busty','curvy','petite','petite_teen','thick','milf','tattoos','mature','bbw','chubby','flat_chested']),
  role:     new Set(['cheerleader','college','maid','role_girlfriend','teacher','cosplay','role_secretary','role_neighbor','role_trainer','role_stewardess']),
  cats:     new Set(['cowgirl','doggy_style','missionary','oral','beach','bedroom','office','shower','boudoir','glamour','interracial','lingerie','pov','reverse_cowgirl','fingering','legs_up','spooning','standing','edge_of_bed','gym','car','outdoor','pool','dorm','massage','amateur','solo','oiled','stockings','voyeur']),
  style:    new Set(['film_grain','golden_hour','studio_flash','natural_window','candlelight','low_key','ring_light','warm_indoor','blue_hour','overcast','harsh_sun']),
};

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
  const paid = cfg.isPaid();
  const filterDemo = (arr, key) => paid ? arr : arr.filter(c => DEMO_ALLOWED[key].has(c.name));
  res.render('prompts/generate', {
    raceCategories:     filterDemo(raceCategories,     'race'),
    bodyTypeCategories: filterDemo(bodyTypeCategories, 'bodytype'),
    roleCategories:     filterDemo(roleCategories,     'role'),
    actCategories:      filterDemo(actCategories,      'cats'),
    sceneCategories:    filterDemo(sceneCategories,    'cats'),
    themeCategories:    filterDemo(themeCategories,    'cats'),
    styleCategories:    filterDemo(styleCategories,    'style'),
    defaultModel, paid, promptTotal: genPromptTotal, title: 'Generate Prompts'
  });
  } catch(e) {
    res.status(500).send('<div style="font-family:sans-serif;padding:40px"><h2>Setup incomplete</h2><p>The database is not ready. Restart the server using <code>install.bat</code> and refresh this page.</p><pre style="color:red">' + e.message + '</pre></div>');
  }
});

router.get('/generate/run', async (req, res) => {
  const { cats, count, model, subject, race, bodytype, role, style, act_random, scene_random, theme_random, hair_color, facial_expression, eye_color, skin_tone, camera_view } = req.query;

  if (!cfg.isPaid()) {
    const promptCount = db.prepare('SELECT COUNT(*) as n FROM prompts').get().n;
    if (promptCount >= 100) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write('data: ' + JSON.stringify({ type: 'limit', msg: 'Free tier limit reached (100 prompts). Purchase a license to generate unlimited prompts.' }) + '\n\n');
      return res.end();
    }
  }

  const safeCount   = cfg.isPaid() ? Math.min(999, Math.max(1, parseInt(count) || 5)) : Math.min(250, Math.max(1, parseInt(count) || 5));
  const safeModel   = (model || 'qwen3.6:35b-a3b').replace(/[^a-zA-Z0-9.:/@_-]/g, '');
  const safeCats    = (cats || '').replace(/[^a-zA-Z0-9_,]/g, '');
  const safeSubject = (subject || '').replace(/[^a-zA-Z0-9 _,-]/g, '').trim();
  const paid = cfg.isPaid();
  const demoFilter = (val, key) => {
    const clean = (val || '').replace(/[^a-z_]/g, '');
    return paid ? clean : (DEMO_ALLOWED[key].has(clean) ? clean : '');
  };
  const DEMO_CATS_ARR = [...DEMO_ALLOWED.cats];
  const DEMO_STYLES_ARR = [...DEMO_ALLOWED.style];
  const anyRandom = act_random === '1' || scene_random === '1' || theme_random === '1';
  const safeCatsGated = paid ? safeCats : safeCats
    ? (safeCats.split(',').filter(c => DEMO_ALLOWED.cats.has(c)).join(',') || null)
    : DEMO_CATS_ARR[Math.floor(Math.random() * DEMO_CATS_ARR.length)];
  // For demo with random flags: merge specific cats + full demo pool so random picks stay within demo set
  const demoCatsWithRandom = !paid && anyRandom
    ? [...new Set([...(safeCatsGated ? safeCatsGated.split(',') : []), ...DEMO_CATS_ARR])].join(',')
    : safeCatsGated;
  const safeRaceGated     = demoFilter(race,     'race');
  const safeBodytype = (bodytype || "").replace(/[^a-z_,]/g, "");
  const safeBodytypeGated = paid ? safeBodytype : safeBodytype.split(",").filter(c => DEMO_ALLOWED.bodytype.has(c)).join(",");
  const safeRoleGated     = demoFilter(role,     'role');
  const rawStyle = (style || '').replace(/[^a-z_]/g, '');
  const safeStyleGated = paid ? rawStyle : (rawStyle ? (DEMO_ALLOWED.style.has(rawStyle) ? rawStyle : '') : DEMO_STYLES_ARR[Math.floor(Math.random() * DEMO_STYLES_ARR.length)]);
  const safeHairColor        = (hair_color        || '').replace(/[^a-z_]/g, '');
  const safeFacialExpression = (facial_expression || '').replace(/[^a-z_]/g, '');
  const safeEyeColor         = (eye_color         || '').replace(/[^a-z_]/g, '');
  const safeSkinTone         = (skin_tone         || '').replace(/[^a-z_]/g, '');
  const safeCameraView       = (camera_view       || '').replace(/[^a-z_]/g, '');

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
  const effectiveCats = paid ? safeCatsGated : demoCatsWithRandom;
  if (effectiveCats)     args.push('--category', effectiveCats);
  if (safeSubject)       args.push('--subject',  safeSubject);
  if (safeRaceGated)     args.push('--race',     safeRaceGated);
  if (safeBodytypeGated) args.push('--bodytype', safeBodytypeGated);
  if (safeRoleGated)     args.push('--role',         safeRoleGated);
  if (safeStyleGated)    args.push('--style',        safeStyleGated);
  if (safeHairColor)        args.push('--hair_color',        safeHairColor);
  if (safeFacialExpression) args.push('--facial_expression', safeFacialExpression);
  if (safeEyeColor)         args.push('--eye_color',         safeEyeColor);
  if (safeSkinTone)         args.push('--skin_tone',         safeSkinTone);
  if (safeCameraView)       args.push('--camera_view',       safeCameraView);
  // only pass random flags for paid users — demo users get restricted cat pool above instead
  if (paid && act_random   === '1') args.push('--act_random');
  if (paid && scene_random === '1') args.push('--scene_random');
  if (paid && theme_random === '1') args.push('--theme_random');
  const llmTemp   = cfg.get('llm_temperature');
  const llmTopP   = cfg.get('llm_top_p');
  const llmRepPen = cfg.get('llm_repetition_penalty');
  const llmMaxTok = cfg.get('llm_max_tokens');
  const llmRaw    = cfg.get('llm_raw_output');
  if (llmTemp)                                 args.push('--temperature',        llmTemp);
  if (llmTopP && parseFloat(llmTopP) > 0)      args.push('--top_p',              llmTopP);
  const llmMinP   = cfg.get('llm_min_p');
  if (llmMinP && parseFloat(llmMinP) > 0)      args.push('--min_p',              llmMinP);
  const llmOllamaParams = cfg.get('llm_ollama_params');
  if (llmOllamaParams && llmOllamaParams !== 'false' && llmRepPen && parseFloat(llmRepPen) > 1)  args.push('--repetition_penalty', llmRepPen);
  if (llmMaxTok)                               args.push('--max_tokens',         llmMaxTok);
  const llmPromptWords = cfg.get('llm_prompt_words');
  if (llmPromptWords)                          args.push('--prompt_words',       llmPromptWords);
  const llmAllowToys = cfg.get('llm_allow_toys');
  if (llmAllowToys === 'true')                 args.push('--allow_toys');
  if (llmRaw === 'true')                       args.push('--raw_output');

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
    .single('workflow')(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ error: err ? err.message : 'No file' });
      // Auto-scan LoRA metadata for trigger words
      try {
        const comfyHost = cfg.get('comfyui_host') || 'localhost';
        const comfyPort = cfg.get('comfyui_port') || '8188';
        const wfContent = JSON.parse(fs2.readFileSync(req.file.path, 'utf8'));
        const loraNodes = Object.values(wfContent).filter(n => n.class_type === 'LoraLoader');
        const allTriggers = [];
        for (const n of loraNodes) {
          const loraName = n.inputs && n.inputs.lora_name;
          if (!loraName) continue;
          try {
            const r = await fetch('http://' + comfyHost + ':' + comfyPort + '/view_metadata/loras?filename=' + encodeURIComponent(loraName));
            const md = await r.json();
            let tagFreq = md.ss_tag_frequency || '{}';
            if (typeof tagFreq === 'string') tagFreq = JSON.parse(tagFreq);
            for (const folder of Object.keys(tagFreq)) {
              const parts = folder.split('_');
              if (parts.length > 1) {
                const trigger = parts.slice(1).join('_');
                if (!allTriggers.includes(trigger)) allTriggers.push(trigger);
              }
            }
          } catch(e) {}
        }
        if (allTriggers.length > 0) {
          wfContent['_spicy'] = { trigger_words: allTriggers.join(', ') };
          fs2.writeFileSync(req.file.path, JSON.stringify(wfContent, null, 2));
        }
        res.json({ filename: req.file.filename, trigger_words: allTriggers.join(', ') || null });
      } catch(e) {
        res.json({ filename: req.file.filename });
      }
    });
});


router.get('/api/comfyui/workflow-meta', (req, res) => {
  const fname = (req.query.filename || '').replace(/[/\\]/g, '').replace(/\.\./g, '');
  if (!fname || !fname.endsWith('.json')) return res.status(400).json({ error: 'Invalid filename' });
  const wfPath = require('path').join(__dirname, '../uploads/workflows', fname);
  try {
    const wf = JSON.parse(require('fs').readFileSync(wfPath, 'utf8'));
    res.json({ trigger_words: (wf['_spicy'] && wf['_spicy'].trigger_words) || '' });
  } catch(e) { res.json({ trigger_words: '' }); }
});

router.post('/api/comfyui/workflow-meta', (req, res) => {
  const fname = (req.body.filename || '').replace(/[/\\]/g, '').replace(/\.\./g, '');
  if (!fname || !fname.endsWith('.json')) return res.status(400).json({ error: 'Invalid filename' });
  const wfPath = require('path').join(__dirname, '../uploads/workflows', fname);
  try {
    const wf = JSON.parse(require('fs').readFileSync(wfPath, 'utf8'));
    const tw = (req.body.trigger_words || '').trim();
    if (tw) { wf['_spicy'] = { trigger_words: tw }; } else { delete wf['_spicy']; }
    require('fs').writeFileSync(wfPath, JSON.stringify(wf, null, 2));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
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
  const { prompt_text, negative_text } = req.body;
  if (!prompt_text) return res.status(400).json({ error: 'prompt_text required' });
  if (req.body.prompt_db_id) {
    const starCheck = db.prepare('SELECT starred FROM prompts WHERE id=?').get(req.body.prompt_db_id);
    if (starCheck?.starred) return res.status(403).json({ ok: false, error: 'Prompt is starred and locked — unstar to regenerate.' });
  }

  const comfyHost    = cfg.get('comfyui_host')     || 'localhost';
  const comfyPort    = cfg.get('comfyui_port')     || '8188';
  // Optional workflow_id override — use prompt's linked workflow instead of configured default
  let workflowFile, wfPath;
  const overrideId = req.body.workflow_id ? parseInt(req.body.workflow_id) : null;
  const usePromptWf = req.body.use_prompt_workflow && req.body.prompt_db_id;
  if (usePromptWf) {
    const pRow = db.prepare('SELECT workflow_json_path FROM prompts WHERE id = ?').get(parseInt(req.body.prompt_db_id));
    if (!pRow || !pRow.workflow_json_path) return res.status(400).json({ error: 'No workflow linked to this prompt.' });
    wfPath = require('path').join(__dirname, '..', pRow.workflow_json_path);
  } else if (overrideId) {
    const wfRow = db.prepare('SELECT workflow_json_path FROM workflows WHERE id = ?').get(overrideId);
    if (!wfRow || !wfRow.workflow_json_path) return res.status(400).json({ error: 'Linked workflow not found.' });
    wfPath = require('path').join(__dirname, '..', wfRow.workflow_json_path);
  } else {
    workflowFile = cfg.get('comfyui_workflow');
    if (!workflowFile) return res.status(400).json({ error: 'No workflow set. Configure one in Settings → ComfyUI.' });
    wfPath = require('path').join(__dirname, '../uploads/workflows', workflowFile);
  }

  const fs2 = require('fs');
  let workflow;
  try { workflow = JSON.parse(fs2.readFileSync(wfPath, 'utf8')); }
  catch (e) { return res.status(400).json({ error: 'Workflow file not found: ' + (workflowFile || wfPath) }); }

  // Extract and strip _spicy metadata (ComfyUI rejects unknown top-level keys)
  const spicyMeta = workflow['_spicy'] || {};
  const triggerWords = (spicyMeta.trigger_words || '').trim();
  delete workflow['_spicy'];

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

  const promptSuffix = (cfg.get('comfyui_prompt_suffix') || '').trim();
  const fullPrompt = triggerWords ? triggerWords + ', ' + prompt_text : prompt_text;
  workflow[nodeId].inputs.text = promptSuffix ? fullPrompt + ', ' + promptSuffix : fullPrompt;

  // Inject negative prompt — use per-request value or fall back to default
  const negText = (negative_text && negative_text.trim()) ? negative_text.trim() : (cfg.get('comfyui_neg_default') || '').trim();
  if (negText) {
    let negNodeId = cfg.get('comfyui_neg_node_id') || '';
    if (!negNodeId) {
      let foundPos = false;
      for (const [id, node] of Object.entries(workflow)) {
        if (node.class_type === 'CLIPTextEncode') {
          if (!foundPos) { foundPos = true; continue; }
          negNodeId = id; break;
        }
      }
    }
    if (negNodeId && workflow[negNodeId]) {
      workflow[negNodeId].inputs.text = negText;
    }
  }

  // Inject model name if configured
  const modelName = cfg.get('comfyui_model') || '';
  if (modelName) {
    for (const node of Object.values(workflow)) {
      if (node.class_type === 'CheckpointLoaderSimple') { node.inputs.ckpt_name = modelName; break; }
      if (node.class_type === 'UNETLoader') { node.inputs.unet_name = modelName; break; }
    }
  }

  // Randomize seed; apply overrides — per-request (from detail page) take priority over global settings
  const stepsOverride   = parseInt(req.body.regen_steps || '') || parseInt(cfg.get('comfyui_steps') || '') || 0;
  const cfgOverride     = req.body.regen_cfg   !== undefined && req.body.regen_cfg   !== '' ? parseFloat(req.body.regen_cfg)   : parseFloat(cfg.get('comfyui_cfg') || '') || 0;
  const denoiseRaw      = req.body.regen_denoise !== undefined && req.body.regen_denoise !== '' ? req.body.regen_denoise : cfg.get('comfyui_denoise');
  const denoiseOverride = denoiseRaw !== '' && denoiseRaw != null ? parseFloat(denoiseRaw) : NaN;
  const samplerOverride = (req.body.regen_sampler || cfg.get('comfyui_sampler') || '').trim();
  for (const node of Object.values(workflow)) {
    if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
      const fixedSeed = req.body.regen_seed ? parseInt(req.body.regen_seed) : null;
      if (node.inputs.seed != null) node.inputs.seed = fixedSeed !== null ? fixedSeed : Math.floor(Math.random() * 2 ** 32);
      if (node.inputs.noise_seed != null) node.inputs.noise_seed = fixedSeed !== null ? fixedSeed : Math.floor(Math.random() * 2 ** 32);
      if (samplerOverride && node.inputs.sampler_name != null) node.inputs.sampler_name = samplerOverride;
      const isPrimaryPass = node.inputs.denoise == null || node.inputs.denoise >= 0.99;
      if (isPrimaryPass) {
        if (stepsOverride && node.inputs.steps != null) node.inputs.steps = stepsOverride;
        if (cfgOverride   && node.inputs.cfg   != null) node.inputs.cfg   = cfgOverride;
        if (!isNaN(denoiseOverride) && node.inputs.denoise != null) node.inputs.denoise = denoiseOverride;
      }
    }
  }
  // Override FluxGuidance node if configured
  const guidanceOverride = parseFloat(cfg.get('comfyui_guidance') || '');
  if (guidanceOverride) {
    for (const node of Object.values(workflow)) {
      if (node.class_type === 'FluxGuidance') { node.inputs.guidance = guidanceOverride; break; }
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
  const { prompt_db_id, filename, subfolder, type } = req.body;
  if (!prompt_db_id || !filename) return res.status(400).json({ error: 'prompt_db_id and filename required' });

  const comfyHost = cfg.get('comfyui_host') || 'localhost';
  const comfyPort = cfg.get('comfyui_port') || '8188';
  const url = `http://${comfyHost}:${comfyPort}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder||'')}&type=${type||'output'}`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`ComfyUI /view returned ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const saveName = `${Date.now()}-comfy-${filename}`;
    const savePath = path.join(__dirname, '../uploads/images', saveName);
    require('fs').writeFileSync(savePath, buf);
    const image_path = `uploads/images/${saveName}`;

    // Extract and save workflow from embedded PNG metadata
    let autoWfPath = null;
    try {
      const chunks = parsePngTextChunks(buf);
      if (chunks.prompt) {
        JSON.parse(chunks.prompt); // validate
        const wfFname = Date.now() + '-comfy-' + filename.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json';
        const wfFpath = path.join(__dirname, '../uploads/workflows/generated', wfFname);
        require('fs').writeFileSync(wfFpath, chunks.prompt);
        autoWfPath = 'uploads/workflows/generated/' + wfFname;
      }
    } catch(e) { /* non-fatal */ }

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

    const updateCols = autoWfPath
      ? 'UPDATE prompts SET image_path=?, seed=?, width=?, height=?, workflow_json_path=?, comfy_prompt_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      : 'UPDATE prompts SET image_path=?, seed=?, width=?, height=?, comfy_prompt_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?';
    const updateArgs = autoWfPath
      ? [image_path, seed, width, height, autoWfPath, prompt_db_id]
      : [image_path, seed, width, height, prompt_db_id];
    db.prepare(updateCols).run(...updateArgs);

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
      const subfolder = imgs[0]?.subfolder || '';
      const imgType = imgs[0]?.type || 'output';
      if (job.status?.completed && filename) return res.json({ status: 'done', filename, subfolder, type: imgType });
      if (job.status?.completed) {
        const msgs = job.status?.messages || [];
        const errEntry = msgs.find(m => m[0] === 'execution_error');
        const detail = errEntry && errEntry[1] ? (errEntry[1].exception_message || errEntry[1].exception_type || '') : '';
        return res.json({ status: 'error', error: detail ? 'ComfyUI error: ' + detail : 'ComfyUI job completed but produced no output image. Check your workflow has a SaveImage node (not PreviewImage).' });
      }
      return res.json({ status: 'error' });
    }
    return res.json({ status: 'unknown' });
  } catch (e) { res.status(502).json({ error: e.message }); }
});



router.post('/api/prompts/texts', (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.json([]);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare('SELECT id, positive, image_path, starred FROM prompts WHERE id IN (' + placeholders + ')').all(...ids);
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
    "SELECT id, comfy_prompt_id FROM prompts WHERE comfy_prompt_id IS NOT NULL"
  ).all();
  res.json(rows);
});


router.post('/api/save-positive', (req, res) => {
  const { id, positive } = req.body;
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
  const starRow = db.prepare('SELECT starred FROM prompts WHERE id=?').get(id);
  if (starRow?.starred) return res.status(403).json({ ok: false, error: 'Prompt is starred and locked.' });
  db.prepare('UPDATE prompts SET positive=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(positive || null, id);
  res.json({ ok: true });
});

router.post('/api/save-adapted', (req, res) => {
  const { id, positive, negative } = req.body;
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
  const starRow = db.prepare('SELECT starred FROM prompts WHERE id=?').get(id);
  if (starRow?.starred) return res.status(403).json({ ok: false, error: 'Prompt is starred and locked.' });
  db.prepare('UPDATE prompts SET positive=?, negative=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(positive || null, negative || null, id);
  res.json({ ok: true });
});

router.get('/api/recent', (req, res) => {
  const n = Math.min(200, Math.max(1, parseInt(req.query.n) || 20));
  const rows = db.prepare('SELECT id, positive FROM prompts ORDER BY created_at DESC LIMIT ?').all(n);
  res.json(rows);
});


// ── Category Admin ─────────────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  const TYPE_ORDER = ['act','scene','theme','role','body_type','race','style'];
  const TYPE_LABELS = { act:'Acts', scene:'Scenes', theme:'Themes', role:'Roles', body_type:'Body Types', race:'Race / Ethnicity', style:'Styles' };
  const rows = db.prepare('SELECT * FROM llm_categories ORDER BY label').all();
  const paid = cfg.isPaid();
  const DEMO_TYPE_MAP = { race: 'race', body_type: 'bodytype', role: 'role', act: 'cats', scene: 'cats', theme: 'cats', style: 'style' };
  const grouped = TYPE_ORDER.map(t => {
    const all = rows.filter(r => r.type === t);
    const demoKey = DEMO_TYPE_MAP[t];
    const visible = paid ? all : all.filter(r => demoKey && DEMO_ALLOWED[demoKey] ? DEMO_ALLOWED[demoKey].has(r.name) : true);
    return { type: t, label: TYPE_LABELS[t] || t, items: visible, hidden: all.length - visible.length };
  }).filter(g => g.items.length);
  const others = rows.filter(r => !TYPE_ORDER.includes(r.type));
  if (others.length) grouped.push({ type: 'other', label: 'Other', items: others, hidden: 0 });
  res.render('prompts/categories', { grouped, total: rows.length, title: 'Prompt Categories', paid, query: req.query });
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
  let wfMeta = null;
  let hasSaveImage = false;
  if (prompt.workflow_json_path) {
    try {
      const wfRaw = require('fs').readFileSync(require('path').join(__dirname, '..', prompt.workflow_json_path), 'utf8');
      const wfJson = JSON.parse(wfRaw);
      const nodes = Array.isArray(wfJson.nodes) ? wfJson.nodes : Object.values(wfJson);
      hasSaveImage = nodes.some(n => n.class_type === 'SaveImage');
      const sampler = nodes.find(n => n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced' || (n.type && (n.type.includes('KSampler'))));
      const inputs = sampler ? (sampler.inputs || (sampler.widgets_values ? { steps: sampler.widgets_values[0], cfg: sampler.widgets_values[2], sampler_name: sampler.widgets_values[4], scheduler: sampler.widgets_values[5] } : {})) : {};
      wfMeta = {
        steps: inputs.steps || prompt.steps || null,
        cfg: inputs.cfg != null ? inputs.cfg : (prompt.cfg_scale || null),
        sampler: inputs.sampler_name || inputs.sampler || prompt.sampler || null,
        scheduler: inputs.scheduler || null,
        denoise: inputs.denoise != null ? inputs.denoise : null,
        seed: prompt.seed || null,
        width: prompt.width || null,
        height: prompt.height || null,
      };
    } catch(e) {}
  } else if (prompt.seed || prompt.steps || prompt.width) {
    wfMeta = { seed: prompt.seed, steps: prompt.steps, cfg: prompt.cfg_scale, sampler: prompt.sampler, width: prompt.width, height: prompt.height, scheduler: null, denoise: null };
  }
  res.render('prompts/detail', { prompt, wfMeta, hasSaveImage, title: prompt.name, paid: cfg.isPaid() });
});

router.put('/:id', upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).render('404', { title: 'Not Found' });
  if (existing.starred) return res.redirect(`/prompts/${req.params.id}?locked=1`);
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
  const row = db.prepare('SELECT starred FROM prompts WHERE id=?').get(req.params.id);
  if (row?.starred) return res.redirect(`/prompts/${req.params.id}?locked=1`);
  db.prepare('DELETE FROM prompts WHERE id = ?').run(req.params.id);
  res.redirect('/prompts');
});


router.post("/batch-delete", (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    db.prepare("DELETE FROM prompts WHERE id IN (" + placeholders + ") AND starred = 0").run(...ids);
  }
  res.redirect("/prompts?" + new URLSearchParams(req.body._back || "").toString());
});


// ── PNG Import ─────────────────────────────────────────────────────────────

function parsePngTextChunks(buf) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 8 || !buf.slice(0, 8).equals(SIG)) return {};
  const result = {};
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString('ascii');
    const data = buf.slice(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === 'tEXt') {
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const key = data.slice(0, nullIdx).toString('latin1');
        const value = data.slice(nullIdx + 1).toString('latin1');
        result[key] = value;
      }
    }
  }
  return result;
}

function parseA1111Params(text) {
  const negIdx = text.indexOf('\nNegative prompt:');
  const positive = (negIdx !== -1 ? text.slice(0, negIdx) : text.split('\nSteps:')[0]).trim();
  let negative = '';
  if (negIdx !== -1) {
    const afterNeg = text.slice(negIdx + '\nNegative prompt:'.length);
    const stepsIdx = afterNeg.indexOf('\nSteps:');
    negative = (stepsIdx !== -1 ? afterNeg.slice(0, stepsIdx) : afterNeg).trim();
  }
  // Parse generation params from the Steps: line
  const metaLine = text.match(/\nSteps:(.+)/) ? text.match(/\nSteps:(.+)/)[0] : '';
  const getParam = (key) => { const m = metaLine.match(new RegExp(key + ':\\s*([^,]+)')); return m ? m[1].trim() : null; };
  const steps   = getParam('Steps')   ? parseInt(getParam('Steps'))   : null;
  const cfg     = getParam('CFG scale') ? parseFloat(getParam('CFG scale')) : null;
  const sampler = getParam('Sampler') || null;
  const seed    = getParam('Seed')    ? parseInt(getParam('Seed'))    : null;
  const sizeStr = getParam('Size');
  const width   = sizeStr ? parseInt(sizeStr.split('x')[0]) : null;
  const height  = sizeStr ? parseInt(sizeStr.split('x')[1]) : null;
  return { positive, negative, steps, cfg, sampler, seed, width, height };
}

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });


// ── Prompt adaptation ────────────────────────────────────────────────────────

function detectWorkflowType(wfJson) {
  try {
    const nodes = Object.values(wfJson);
    if (nodes.some(n => n.class_type === 'FluxGuidance' || n.class_type === 'UNETLoader')) return 'flux';
    if (nodes.some(n => n.class_type === 'CheckpointLoaderSimple')) {
      const ckpt = nodes.find(n => n.class_type === 'CheckpointLoaderSimple');
      const name = (ckpt?.inputs?.ckpt_name || '').toLowerCase();
      if (name.includes('xl') || name.includes('sdxl')) return 'sdxl';
      return 'sd15';
    }
    // Graph format fallback
    if (wfJson.nodes && Array.isArray(wfJson.nodes)) {
      const ns = wfJson.nodes;
      if (ns.some(n => n.type === 'FluxGuidance' || n.type === 'UNETLoader')) return 'flux';
      if (ns.some(n => n.type === 'CheckpointLoaderSimple')) {
        const ckpt = ns.find(n => n.type === 'CheckpointLoaderSimple');
        const name = (ckpt?.widgets_values?.[0] || '').toLowerCase();
        if (name.includes('xl') || name.includes('sdxl')) return 'sdxl';
        return 'sd15';
      }
    }
  } catch(e) {}
  return 'unknown';
}

function ruleBasedAdapt(positiveText, negativeText) {
  let pos = positiveText || '';
  const negParts = (negativeText || '').split(',').map(s => s.trim()).filter(Boolean);
  // Extract inline negative weights: (word:-0.8) → add to negatives
  pos = pos.replace(/\(([^)]+):-[\d.]+\)/g, (_, words) => { negParts.push(words.trim()); return ''; });
  // Strip positive weights: (word:1.2) → word
  pos = pos.replace(/\(([^)]+):[\d.]+\)/g, '$1');
  // Strip bare emphasis parens: ((word)) → word
  pos = pos.replace(/\(\(([^)]+)\)\)/g, '$1').replace(/\(([^)]+)\)/g, '$1');
  // Strip square bracket de-emphasis
  pos = pos.replace(/\[([^\]]+)\]/g, '$1');
  // Strip LoRA refs
  pos = pos.replace(/<lora:[^>]+>/gi, '');
  // Clean up
  pos = pos.replace(/,\s*,+/g, ',').replace(/^\s*,|,\s*$/g, '').replace(/\s+/g, ' ').trim();
  return { positive: pos, negative: negParts.join(', ') };
}

router.get('/api/adapt-status', (req, res) => {
  const adaptUrl = cfg.get('adapt_llm_base_url') || '';
  const adaptKey = cfg.get('adapt_llm_api_key') || '';
  const mainUrl  = cfg.get('llm_base_url') || '';
  const mainKey  = cfg.get('llm_api_key') || '';

  const effectiveUrl = adaptUrl || mainUrl;
  const effectiveKey = adaptKey || mainKey;
  const isLocal = !effectiveUrl || /localhost|127\.0\.0\.1/.test(effectiveUrl);
  const hasLlm = !!(effectiveUrl && effectiveKey);
  const llmType = !hasLlm ? 'none' : isLocal ? 'local' : 'frontier';

  let workflowType = 'unknown';
  const wfFile = cfg.get('comfyui_workflow');
  if (wfFile) {
    try {
      const wfPath = require('path').join(__dirname, '../uploads/workflows', wfFile);
      const wfJson = JSON.parse(require('fs').readFileSync(wfPath, 'utf8'));
      workflowType = detectWorkflowType(wfJson);
    } catch(e) {}
  }

  res.json({ llm_type: llmType, workflow_type: workflowType });
});

router.post('/api/adapt-prompt', async (req, res) => {
  const { positive, negative, use_llm } = req.body;
  const ruled = ruleBasedAdapt(positive, negative);

  if (!use_llm) return res.json({ ok: true, positive: ruled.positive, negative: ruled.negative, method: 'rule' });

  const adaptUrl = cfg.get('adapt_llm_base_url') || cfg.get('llm_base_url') || '';
  const adaptKey = cfg.get('adapt_llm_api_key') || cfg.get('llm_api_key') || '';
  const adaptModel = cfg.get('adapt_llm_model') || cfg.get('llm_default_model') || 'gpt-4o-mini';

  if (!adaptUrl || !adaptKey) return res.json({ ok: true, positive: ruled.positive, negative: ruled.negative, method: 'rule' });

  let workflowType = 'flux';
  const wfFile = cfg.get('comfyui_workflow');
  if (wfFile) {
    try {
      const wfPath = require('path').join(__dirname, '../uploads/workflows', wfFile);
      workflowType = detectWorkflowType(JSON.parse(require('fs').readFileSync(wfPath, 'utf8')));
    } catch(e) {}
  }

  const styleGuide = {
    flux:    'natural language prose paragraphs. Flux uses a T5 encoder that understands sentences — avoid keyword lists.',
    sdxl:    'detailed descriptive phrases separated by commas. Quality boosters like "masterpiece, best quality" work well.',
    sd15:    'concise comma-separated keywords and tags. Keep it under 77 tokens.',
    unknown: 'natural language prose.',
  }[workflowType] || 'natural language prose.';

  const systemPrompt = `You are a Stable Diffusion prompt engineer.
Your job: take a structured prompt with labeled sections and rewrite it as a single unified description.

Input format example:
Subject: A tall woman with red hair. Scene: She stands in a park. Lighting: Golden hour.

Correct output (positive field):
A tall woman with long red hair stands in a sunlit park bathed in warm golden hour light.

Wrong output (do NOT do this):
Subject: A tall woman with red hair. Scene: She stands in a park. Lighting: Golden hour.

Rewrite the given prompt in ${styleGuide}
Rules:
- Strip ALL section labels (Subject:, Scene:, Framing:, Details:, Body:, Expression:, Setting:, Lighting:, Photo Style:, Clothing:, Ass:, Breasts:, Cum:, and any other label:).
- Merge everything into one flowing unified description — no headers, no colons used as labels.
- Preserve every visual detail: appearance, pose, clothing, setting, lighting, mood, photo style.
- Move negative/exclusionary concepts to the negative field.
Respond with ONLY valid JSON: {"positive": "...", "negative": "..."}`;

  try {
    const isAnthropic = adaptUrl.includes('anthropic.com');
    const userMsg = 'Positive: ' + ruled.positive + (ruled.negative ? '\nNegative: ' + ruled.negative : '');
    let fetchUrl, fetchHeaders, fetchBody;
    if (isAnthropic) {
      fetchUrl = 'https://api.anthropic.com/v1/messages';
      fetchHeaders = { 'Content-Type': 'application/json', 'x-api-key': adaptKey, 'anthropic-version': '2023-06-01' };
      fetchBody = JSON.stringify({ model: adaptModel || 'claude-haiku-4-5-20251001', system: systemPrompt, messages: [{ role: 'user', content: userMsg }], max_tokens: 1200 });
    } else {
      fetchUrl = adaptUrl.replace(/\/$/, '') + '/chat/completions';
      fetchHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adaptKey };
      fetchBody = JSON.stringify({ model: adaptModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], temperature: 0.3, max_tokens: 1200 });
    }
    const r = await fetch(fetchUrl, { method: 'POST', headers: fetchHeaders, body: fetchBody });
    const d = await r.json();
    const text = isAnthropic ? (d.content?.[0]?.text || '') : (d.choices?.[0]?.message?.content || '');
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${d.error?.message || d.type || ''}`);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.json({ ok: true, positive: parsed.positive || ruled.positive, negative: parsed.negative || ruled.negative, method: 'llm', workflow_type: workflowType });
    }
  } catch(e) { /* fall through to rule result */ }

  res.json({ ok: true, positive: ruled.positive, negative: ruled.negative, method: 'rule' });
});

router.post('/api/import-png', memUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const chunks = parsePngTextChunks(req.file.buffer);
  const originalFilename = req.file.originalname || '';
  const fileBasename = originalFilename.replace(/\.png$/i, '').replace(/[_-]/g, ' ').trim();

  let positive = '', negative = '', workflow_json = null;
  let wfMeta = { sampler: null, scheduler: null, steps: null, cfg: null, denoise: null, model: null };

  if (chunks.parameters) {
    const p = parseA1111Params(chunks.parameters);
    positive = p.positive;
    negative = p.negative;
    if (p.steps)   wfMeta.steps   = p.steps;
    if (p.cfg)     wfMeta.cfg     = p.cfg;
    if (p.sampler) wfMeta.sampler = p.sampler;
    if (p.seed)    wfMeta.seed    = p.seed;
    if (p.width)   wfMeta.width   = p.width;
    if (p.height)  wfMeta.height  = p.height;
  }

  // chunks.prompt = API format (flat dict, class_type+inputs) — use for queueing
  // chunks.workflow = graph format (nodes array, type+widgets_values) — use for display/settings
  if (chunks.prompt) {
    try {
      const p = JSON.parse(chunks.prompt);
      const nodes = Object.values(p);
      const clips = nodes.filter(n => n.class_type === 'CLIPTextEncode');
      const resolveText = (val) => {
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) { // node reference [nodeId, outputIdx]
          const refNode = p[val[0]];
          if (refNode && refNode.class_type === 'CLIPTextEncode') return (refNode.inputs && typeof refNode.inputs.text === 'string') ? refNode.inputs.text : '';
          if (refNode && refNode.inputs && typeof refNode.inputs.text === 'string') return refNode.inputs.text;
          if (refNode && refNode.inputs && typeof refNode.inputs.text_g === 'string') return refNode.inputs.text_g;
        }
        return '';
      };
      if (!positive && clips.length > 0) positive = resolveText(clips[0].inputs && clips[0].inputs.text) || '';
      if (!negative && clips.length > 1) negative = resolveText(clips[1].inputs && clips[1].inputs.text) || '';
      // KSampler / KSamplerAdvanced
      const sampler = nodes.find(n => n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced');
      if (sampler && sampler.inputs) {
        wfMeta.sampler   = sampler.inputs.sampler_name || null;
        wfMeta.scheduler = sampler.inputs.scheduler || null;
        wfMeta.steps     = sampler.inputs.steps || null;
        wfMeta.cfg       = sampler.inputs.cfg != null ? sampler.inputs.cfg : null;
        wfMeta.denoise   = sampler.inputs.denoise != null ? sampler.inputs.denoise : null;
      }
      // SamplerCustomAdvanced — sampler from KSamplerSelect, steps from BasicScheduler
      if (!wfMeta.sampler) {
        const kss = nodes.find(n => n.class_type === 'KSamplerSelect');
        if (kss && kss.inputs) wfMeta.sampler = kss.inputs.sampler_name || null;
        const sched = nodes.find(n =>
          n.class_type === 'BasicScheduler' || n.class_type === 'SDTurboScheduler' || n.class_type === 'KarrasScheduler'
        );
        if (sched && sched.inputs) {
          wfMeta.scheduler = sched.inputs.scheduler || wfMeta.scheduler;
          wfMeta.steps     = sched.inputs.steps != null ? sched.inputs.steps : wfMeta.steps;
          wfMeta.denoise   = sched.inputs.denoise != null ? sched.inputs.denoise : wfMeta.denoise;
        }
      }
      // FluxGuidance
      const fg = nodes.find(n => n.class_type === 'FluxGuidance');
      if (fg && fg.inputs && fg.inputs.guidance != null) wfMeta.guidance = fg.inputs.guidance;
      // Model
      const modelNode = nodes.find(n => n.class_type === 'UNETLoader' || n.class_type === 'CheckpointLoaderSimple');
      if (modelNode && modelNode.inputs) {
        wfMeta.model = (modelNode.inputs.unet_name || modelNode.inputs.ckpt_name || '').replace(/\.safetensors$/i, '') || null;
      }
      workflow_json = chunks.prompt; // API format — works with queue endpoint
    } catch(e) {}
  }

  if (chunks.workflow && !workflow_json) {
    // Fallback: graph format — extract what we can from nodes array
    try {
      const wf = JSON.parse(chunks.workflow);
      if (wf.nodes && Array.isArray(wf.nodes)) {
        const clips = wf.nodes.filter(n => n.type === 'CLIPTextEncode');
        if (!positive && clips.length > 0) positive = (clips[0].widgets_values && clips[0].widgets_values[0]) || '';
        if (!negative && clips.length > 1) negative = (clips[1].widgets_values && clips[1].widgets_values[0]) || '';
        // KSampler widgets_values: [seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise]
        const sampler = wf.nodes.find(n => n.type === 'KSampler' || n.type === 'KSamplerAdvanced');
        if (sampler && sampler.widgets_values) {
          wfMeta.steps     = sampler.widgets_values[2] || null;
          wfMeta.cfg       = sampler.widgets_values[3] != null ? sampler.widgets_values[3] : null;
          wfMeta.sampler   = sampler.widgets_values[4] || null;
          wfMeta.scheduler = sampler.widgets_values[5] || null;
          wfMeta.denoise   = sampler.widgets_values[6] != null ? sampler.widgets_values[6] : null;
        }
        // SamplerCustomAdvanced — KSamplerSelect + BasicScheduler
        if (!wfMeta.sampler) {
          const kss = wf.nodes.find(n => n.type === 'KSamplerSelect');
          if (kss && kss.widgets_values) wfMeta.sampler = kss.widgets_values[0] || null;
          const sched = wf.nodes.find(n =>
            n.type === 'BasicScheduler' || n.type === 'SDTurboScheduler' || n.type === 'KarrasScheduler'
          );
          if (sched && sched.widgets_values) {
            // BasicScheduler widgets_values: [scheduler, steps, denoise]
            wfMeta.scheduler = sched.widgets_values[0] || wfMeta.scheduler;
            wfMeta.steps     = sched.widgets_values[1] != null ? sched.widgets_values[1] : wfMeta.steps;
            wfMeta.denoise   = sched.widgets_values[2] != null ? sched.widgets_values[2] : wfMeta.denoise;
          }
        }
        // FluxGuidance widgets_values: [guidance]
        const fg = wf.nodes.find(n => n.type === 'FluxGuidance');
        if (fg && fg.widgets_values && fg.widgets_values[0] != null) wfMeta.guidance = fg.widgets_values[0];
        // Model
        const modelNode = wf.nodes.find(n => n.type === 'UNETLoader' || n.type === 'CheckpointLoaderSimple');
        if (modelNode && modelNode.widgets_values) {
          wfMeta.model = (modelNode.widgets_values[0] || '').replace(/\.safetensors$/i, '') || null;
        }
      }
      workflow_json = chunks.workflow; // graph format — note: queue endpoint may not handle this
    } catch(e) {}
  }

  // Build suggested workflow name: model name if found, else PNG filename
  const suggestedName = wfMeta.model || fileBasename || 'Imported from image';

  // Save PNG to uploads/images so the prompt gets a preview
  let importedImagePath = null;
  try {
    const imgFname = Date.now() + '-imported-' + originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    require('fs').writeFileSync(path.join(__dirname, '../uploads/images', imgFname), req.file.buffer);
    importedImagePath = 'uploads/images/' + imgFname;
  } catch(e) { /* non-fatal */ }

  const sourceFormat = workflow_json ? 'comfyui' : chunks.parameters ? 'a1111' : 'unknown';

  res.json({
    positive: (typeof positive === 'string' ? positive : '').trim(),
    negative: (typeof negative === 'string' ? negative : '').trim(),
    has_workflow: !!(workflow_json),
    workflow_json: workflow_json || null,
    has_prompt: !!(typeof positive === 'string' && positive.trim()),
    suggested_name: suggestedName,
    source_filename: originalFilename,
    wf_meta: wfMeta,
    image_path: importedImagePath,
    source_format: sourceFormat,
  });
});

router.post('/api/import-png/save', (req, res) => {
  const { positive, negative, save_workflow, workflow_json, workflow_name, source_filename, wf_meta, image_path } = req.body;
  const importMeta = wf_meta || {};
  let savedWfPath = null;

  if (save_workflow && workflow_json) {
    try {
      const fs2 = require('fs');
      JSON.parse(workflow_json); // validate
      const fname = Date.now() + '-imported.json';
      const fpath = path.join(__dirname, '../uploads/workflows', fname);
      fs2.writeFileSync(fpath, workflow_json);
      savedWfPath = 'uploads/workflows/' + fname;
    } catch(e) {
      return res.status(400).json({ error: 'Invalid workflow JSON: ' + e.message });
    }
  }

  const name = (positive || '').slice(0, 80).trim() || 'Imported prompt';
  const result = db.prepare('INSERT INTO prompts (name, positive, negative, tags, workflow_json_path, image_path, steps, cfg_scale, sampler, seed, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    name, positive || null, negative || null, 'imported', savedWfPath, image_path || null,
    importMeta.steps || null, importMeta.cfg || null, importMeta.sampler || null,
    importMeta.seed || null, importMeta.width || null, importMeta.height || null
  );

  res.json({ ok: true, id: result.lastInsertRowid });
});


module.exports = router;
