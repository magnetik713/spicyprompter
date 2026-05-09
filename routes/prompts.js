const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/images'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const { model, q } = req.query;
  let query = `
    SELECT p.*, w.name AS workflow_name
    FROM prompts p
    LEFT JOIN workflows w ON p.workflow_id = w.id
    WHERE 1=1
  `;
  const params = [];
  if (model && model !== 'All') {
    query += ' AND p.base_model = ?';
    params.push(model);
  }
  if (q) {
    query += ' AND (p.name LIKE ? OR p.tags LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY p.created_at DESC';
  const prompts = db.prepare(query).all(...params);
  const models = db.prepare('SELECT DISTINCT base_model FROM prompts WHERE base_model IS NOT NULL').all().map(r => r.base_model);
  res.render('prompts/index', { prompts, models, currentModel: model || 'All', q: q || '', title: 'Prompt Library' });
});

router.get('/api/workflow/:id', (req, res) => {
  const wf = db.prepare('SELECT id, base_model FROM workflows WHERE id = ?').get(req.params.id);
  res.json(wf || {});
});

router.get('/api/loras', async (req, res) => {
  try {
    const r = await fetch('http://192.168.1.30:8188/object_info/LoraLoader');
    const d = await r.json();
    res.json(d.LoraLoader?.input?.required?.lora_name?.[0] || []);
  } catch (e) {
    res.json([]);
  }
});

router.get('/new', (req, res) => {
  const workflows = db.prepare('SELECT id, name FROM workflows ORDER BY name').all();
  const models = db.prepare('SELECT DISTINCT base_model FROM prompts WHERE base_model IS NOT NULL').all().map(r => r.base_model);
  res.render('prompts/form', { prompt: {}, workflows, models, title: 'New Prompt', action: '/prompts', method: 'POST' });
});

router.post('/', upload.single('image'), (req, res) => {
  const { name, workflow_id, base_model, environment, scene, negative, loras, trigger_words, tags, notes } = req.body;
  if (!name) return res.status(400).send('Name is required');
  const image_path = req.file ? `uploads/images/${req.file.filename}` : null;
  const result = db.prepare(`
    INSERT INTO prompts (name, workflow_id, base_model, environment, scene, negative, loras, trigger_words, tags, image_path, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, workflow_id || null, base_model || null, environment || null, scene || null,
         negative || null, loras || null, trigger_words || null, tags || null, image_path, notes || null);
  res.redirect(`/prompts/${result.lastInsertRowid}`);
});

router.get('/:id/edit', (req, res) => {
  const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!prompt) return res.status(404).render('404', { title: 'Not Found' });
  const workflows = db.prepare('SELECT id, name FROM workflows ORDER BY name').all();
  const models = db.prepare('SELECT DISTINCT base_model FROM prompts WHERE base_model IS NOT NULL').all().map(r => r.base_model);
  res.render('prompts/form', { prompt, workflows, models, title: `Edit ${prompt.name}`, action: `/prompts/${prompt.id}?_method=PUT`, method: 'POST' });
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
  const { name, workflow_id, base_model, environment, scene, negative, loras, trigger_words, tags, notes } = req.body;
  if (!name) return res.status(400).send('Name is required');
  const image_path = req.file ? `uploads/images/${req.file.filename}` : existing.image_path;
  db.prepare(`
    UPDATE prompts SET name=?, workflow_id=?, base_model=?, environment=?, scene=?,
    negative=?, loras=?, trigger_words=?, tags=?, image_path=?, notes=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, workflow_id || null, base_model || null, environment || null, scene || null,
         negative || null, loras || null, trigger_words || null, tags || null,
         image_path, notes || null, req.params.id);
  res.redirect(`/prompts/${req.params.id}`);
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM prompts WHERE id = ?').run(req.params.id);
  res.redirect('/prompts');
});

module.exports = router;
