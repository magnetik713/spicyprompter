const express = require('express');
const router = express.Router();
const cfg = require('../config');

router.get('/', (req, res) => {
  const config = cfg.getAll();
  const saved = req.query.saved === '1';
  const pkg = require('../package.json'); res.render('settings', { config, saved, query: req.query, title: 'Settings', version: pkg.version });
});

router.post('/', (req, res) => {
  const { llm_base_url, llm_api_key, llm_default_model, comfyui_host, comfyui_port } = req.body;
  if (llm_base_url)      cfg.set('llm_base_url',      llm_base_url.trim());
  if (llm_api_key !== undefined) cfg.set('llm_api_key', llm_api_key.trim());
  if (llm_default_model) cfg.set('llm_default_model', llm_default_model.trim());
  if (comfyui_host)      cfg.set('comfyui_host',      comfyui_host.trim());
  if (comfyui_port)      cfg.set('comfyui_port',      comfyui_port.trim());
  if (req.body.comfyui_workflow !== undefined) cfg.set('comfyui_workflow', (req.body.comfyui_workflow || '').trim());
  if (req.body.comfyui_node_id  !== undefined) cfg.set('comfyui_node_id',  (req.body.comfyui_node_id  || '').trim());
  if (req.body.comfyui_neg_node_id !== undefined) cfg.set('comfyui_neg_node_id', (req.body.comfyui_neg_node_id || '').trim());
  if (req.body.comfyui_model    !== undefined) cfg.set('comfyui_model',    (req.body.comfyui_model    || '').trim());
  if (req.body.comfyui_prompt_suffix !== undefined) cfg.set('comfyui_prompt_suffix', req.body.comfyui_prompt_suffix || '');
  if (req.body.comfyui_neg_default   !== undefined) cfg.set('comfyui_neg_default',   req.body.comfyui_neg_default   || '');
  if (req.body.comfyui_steps    !== undefined) cfg.set('comfyui_steps',    (req.body.comfyui_steps    || '').trim());
  if (req.body.comfyui_cfg      !== undefined) cfg.set('comfyui_cfg',      (req.body.comfyui_cfg      || '').trim());
  if (req.body.comfyui_guidance !== undefined) cfg.set('comfyui_guidance', (req.body.comfyui_guidance || '').trim());
  if (req.body.comfyui_sampler  !== undefined) cfg.set('comfyui_sampler',  (req.body.comfyui_sampler  || '').trim());
  if (req.body.llm_temperature)                cfg.set('llm_temperature',          req.body.llm_temperature.trim());
  if (req.body.llm_top_p !== undefined)        cfg.set('llm_top_p',                req.body.llm_top_p || '');
  if (req.body.llm_min_p !== undefined)        cfg.set('llm_min_p',                req.body.llm_min_p || '');
  if (req.body.llm_repetition_penalty)         cfg.set('llm_repetition_penalty',   req.body.llm_repetition_penalty.trim());
  if (req.body.llm_max_tokens)                 cfg.set('llm_max_tokens',           req.body.llm_max_tokens.trim());
  if (req.body.llm_prompt_words)               cfg.set('llm_prompt_words',         req.body.llm_prompt_words.trim());
  cfg.set('llm_raw_output', req.body.llm_raw_output === 'on' ? 'true' : 'false');
  cfg.set('llm_allow_toys', req.body.llm_allow_toys === 'on' ? 'true' : 'false');
  cfg.set('llm_ollama_params', req.body.llm_ollama_params === 'on' ? 'true' : 'false');
  res.redirect('/prompts/settings?saved=1');
});

router.post('/test', async (req, res) => {
  const { url, key } = req.body;
  try {
    const headers = {};
    if (key && key.trim()) headers['Authorization'] = `Bearer ${key.trim()}`;
    const r = await fetch(`${url.trim()}/models`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return res.json({ ok: false, error: `HTTP ${r.status}` });
    const data = await r.json();
    const models = (data.data || data.models || []).map(m => m.id || m.name || m).filter(Boolean);
    res.json({ ok: true, models });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

router.post('/license', async (req, res) => {
  const key = (req.body.license_key || '').trim();
  if (!key) return res.redirect('/prompts/settings?license=missing');
  try {
    const https = require('https');
    const params = new URLSearchParams({ product_id: 'AylEKdF8-sFMHlSHeN03hQ==', license_key: key, increment_uses_count: 'false' }).toString();
    const result = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'gumroad.com',
        path: '/api/v2/licenses/verify',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(params) }
      }, res2 => {
        const chunks = [];
        res2.on('data', c => chunks.push(c));
        res2.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
      });
      req2.on('error', reject);
      req2.write(params);
      req2.end();
    });

    if (result.success) {
      cfg.set('license_key',    key);
      cfg.set('license_status', 'paid');
      res.redirect('/prompts/settings?license=ok');
    } else {
      res.redirect('/prompts/settings?license=invalid');
    }
  } catch (e) {
    res.redirect('/prompts/settings?license=error');
  }
});

router.post('/license/reset', (req, res) => {
  cfg.set('license_key',    '');
  cfg.set('license_status', 'free');
  res.redirect('/prompts/settings?license=reset');
});

module.exports = router;

