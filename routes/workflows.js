const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/workflows'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const SAMPLERS = [
  'euler','euler_ancestral','dpmpp_2m','dpmpp_2m_sde','dpmpp_3m_sde',
  'dpmpp_sde','dpm_2','dpm_2_ancestral','heun','lms','ddim',
  'uni_pc','lcm','dpmpp_2s_ancestral','euler_cfg_pp','euler_ancestral_cfg_pp'
];
const SCHEDULERS = [
  'karras','sgm_uniform','simple','exponential','ddim_uniform',
  'beta','normal','linear_quadratic','kl_optimal'
];

router.get('/', (req, res) => {
  const workflows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all();
  res.render('workflows/index', { workflows, title: 'Workflows' });
});

router.get('/new', (req, res) => {
  const models = db.prepare('SELECT DISTINCT base_model FROM workflows WHERE base_model IS NOT NULL').all().map(r => r.base_model);
  res.render('workflows/form', {
    workflow: {}, samplers: SAMPLERS, schedulers: SCHEDULERS, models,
    title: 'New Workflow', action: '/prompts/workflows', method: 'POST'
  });
});

router.post('/', upload.single('workflow_json'), (req, res) => {
  const { name, source_url, base_model, dependencies, sampler, scheduler, steps, cfg_scale, denoise, notes } = req.body;
  const workflow_json_path = req.file ? `uploads/workflows/${req.file.filename}` : null;
  const result = db.prepare(`
    INSERT INTO workflows (name, source_url, base_model, dependencies, sampler, scheduler, steps, cfg_scale, denoise, notes, workflow_json_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name || null, source_url || null, base_model || null, dependencies || null,
    sampler || null, scheduler || null,
    steps ? parseInt(steps) : null,
    cfg_scale ? parseFloat(cfg_scale) : null,
    denoise ? parseFloat(denoise) : null,
    notes || null, workflow_json_path
  );
  res.redirect(`/prompts/workflows/${result.lastInsertRowid}`);
});

router.get('/:id/edit', (req, res) => {
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!workflow) return res.status(404).render('404', { title: 'Not Found' });
  const models = db.prepare('SELECT DISTINCT base_model FROM workflows WHERE base_model IS NOT NULL').all().map(r => r.base_model);
  res.render('workflows/form', {
    workflow, samplers: SAMPLERS, schedulers: SCHEDULERS, models,
    title: `Edit ${workflow.name}`,
    action: `/prompts/workflows/${workflow.id}?_method=PUT`, method: 'POST'
  });
});

router.get('/:id', (req, res) => {
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!workflow) return res.status(404).render('404', { title: 'Not Found' });
  const linkedPrompts = db.prepare('SELECT id, name, base_model, tags FROM prompts WHERE workflow_id = ?').all(req.params.id);
  res.render('workflows/detail', { workflow, linkedPrompts, title: workflow.name });
});

router.put('/:id', upload.single('workflow_json'), (req, res) => {
  const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).render('404', { title: 'Not Found' });
  const { name, source_url, base_model, dependencies, sampler, scheduler, steps, cfg_scale, denoise, notes } = req.body;
  const workflow_json_path = req.file ? `uploads/workflows/${req.file.filename}` : existing.workflow_json_path;
  db.prepare(`
    UPDATE workflows SET name=?, source_url=?, base_model=?, dependencies=?, sampler=?, scheduler=?,
    steps=?, cfg_scale=?, denoise=?, notes=?, workflow_json_path=? WHERE id=?
  `).run(
    name || null, source_url || null, base_model || null, dependencies || null,
    sampler || null, scheduler || null,
    steps ? parseInt(steps) : null,
    cfg_scale ? parseFloat(cfg_scale) : null,
    denoise ? parseFloat(denoise) : null,
    notes || null, workflow_json_path, req.params.id
  );
  res.redirect(`/prompts/workflows/${req.params.id}`);
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id);
  res.redirect('/prompts/workflows');
});

module.exports = router;
