// SERVER-ONLY — exclude from distribution package
const express = require('express');
const router  = express.Router();
const http    = require('http');
const db      = require('../db');
const cfg     = require('../config');

const ANATOMY_SUFFIX   = 'perfect human anatomy, two arms, two legs, five fingers on each hand, no extra limbs, no deformities, correct body proportions, symmetrical face';
const FACE_LOCK_PREFIX = 'same face as reference image, identical facial features, same eye color, same nose shape, same lip shape, same jawline, same skin tone, same bone structure, preserve identity, do not alter face, ';

function comfyUrl() {
  const h = cfg.get('comfyui_host') || 'localhost';
  const p = cfg.get('comfyui_port') || '8188';
  return `http://${h}:${p}`;
}

async function comfyFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: body ? { 'Content-Type': 'application/json' } : {} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(comfyUrl() + path, opts);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function uploadRef(base64Data) {
  const m = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) throw new Error('Invalid image data');
  const buf = Buffer.from(m[2], 'base64');
  const ext = m[1].split('/')[1] || 'png';
  const boundary = '----Boundary' + Date.now();
  const filename  = 'ref_' + Date.now() + '.' + ext;
  const pre  = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${m[1]}\r\n\r\n`);
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const r = await fetch(comfyUrl() + '/upload/image', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([pre, buf, post])
  });
  const j = await r.json();
  return j.name;
}

function refLatent(refName, vaeNode, w, h) {
  if (!refName) return { nodes: { '50': { class_type: 'EmptyLatentImage', inputs: { width: w, height: h, batch_size: 1 } } }, ref: ['50', 0] };
  return {
    nodes: {
      '50': { class_type: 'LoadImage',  inputs: { image: refName } },
      '51': { class_type: 'ImageScale', inputs: { image: ['50', 0], upscale_method: 'lanczos', width: w, height: h, crop: 'disabled' } },
      '52': { class_type: 'VAEEncode',  inputs: { pixels: ['51', 0], vae: [vaeNode, 0] } },
    },
    ref: ['52', 0]
  };
}

// ── Workflows ────────────────────────────────────────────────────────────────

function buildKrea2Workflow(prompt, refName, denoise, faceLock) {
  const seed = Math.floor(Math.random() * 999999999999999);
  const p = (faceLock && refName) ? FACE_LOCK_PREFIX + prompt : prompt;
  const base = {
    '1': { class_type: 'VAELoader',  inputs: { vae_name: 'qwen_image_vae.safetensors' } },
    '2': { class_type: 'UNETLoader', inputs: { unet_name: 'krea2_turbo_mxfp8.safetensors', weight_dtype: 'default' } },
    '3': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_4b_bf16.safetensors', type: 'krea2' } },
    '4': { class_type: 'LoraLoader', inputs: { model: ['2', 0], clip: ['3', 0], lora_name: 'snofs_krea_v1.safetensors', strength_model: 1.0, strength_clip: 1.0 } },
  };
  const { nodes: ln, ref } = refLatent(refName, '1', 576, 1024);
  const posNode = (faceLock && refName)
    ? { '7': { class_type: 'TextEncodeQwenImageEdit', inputs: { clip: ['4', 1], prompt: p, vae: ['1', 0], image: ['50', 0] } } }
    : { '7': { class_type: 'CLIPTextEncode', inputs: { text: p, clip: ['4', 1] } } };
  return { ...base, ...ln, ...posNode,
    '8':  { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['7', 0] } },
    '9':  { class_type: 'KSampler', inputs: { model: ['4', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ref, seed, control_after_generate: 'randomize', steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise } },
    '10': { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['1', 0] } },
    '11': { class_type: 'SaveImage', inputs: { images: ['10', 0], filename_prefix: 'Krea2' } },
  };
}

function buildKrea2FullWorkflow(prompt, refName, denoise, faceLock) {
  const seed = Math.floor(Math.random() * 999999999999999);
  const p = (faceLock && refName) ? FACE_LOCK_PREFIX + prompt : prompt;
  const base = {
    '1':  { class_type: 'VAELoader',  inputs: { vae_name: 'qwen_image_vae.safetensors' } },
    '2':  { class_type: 'UNETLoader', inputs: { unet_name: 'krea2_turbo_mxfp8.safetensors', weight_dtype: 'default' } },
    '3':  { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_4b_bf16.safetensors', type: 'krea2' } },
    '4':  { class_type: 'LoraLoader', inputs: { model: ['2', 0],  clip: ['3', 0],  lora_name: 'SummerVibesHM_krea2_epoch8.safetensors', strength_model: 1.0, strength_clip: 1.0 } },
    '11': { class_type: 'LoraLoader', inputs: { model: ['4', 0],  clip: ['4', 1],  lora_name: 'krea2_nud3.safetensors',                 strength_model: 1.0, strength_clip: 1.0 } },
    '12': { class_type: 'LoraLoader', inputs: { model: ['11', 0], clip: ['11', 1], lora_name: 'galaxyace_krea2.safetensors',             strength_model: 1.0, strength_clip: 1.0 } },
    '13': { class_type: 'LoraLoader', inputs: { model: ['12', 0], clip: ['12', 1], lora_name: 'realism_engine_krea2_v2.safetensors',     strength_model: 1.0, strength_clip: 1.0 } },
    '14': { class_type: 'LoraLoader', inputs: { model: ['13', 0], clip: ['13', 1], lora_name: 'FAC1AL_v1_krea2.safetensors',             strength_model: 1.0, strength_clip: 1.0 } },
  };
  const { nodes: ln, ref } = refLatent(refName, '1', 576, 1024);
  const posNode = (faceLock && refName)
    ? { '7': { class_type: 'TextEncodeQwenImageEdit', inputs: { clip: ['14', 1], prompt: p, vae: ['1', 0], image: ['50', 0] } } }
    : { '7': { class_type: 'CLIPTextEncode', inputs: { text: p, clip: ['14', 1] } } };
  return { ...base, ...ln, ...posNode,
    '8':  { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['7', 0] } },
    '9':  { class_type: 'KSampler', inputs: { model: ['14', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ref, seed, control_after_generate: 'randomize', steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise } },
    '10': { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['1', 0] } },
    '15': { class_type: 'SaveImage', inputs: { images: ['10', 0], filename_prefix: 'Krea2Full' } },
  };
}

function build3VectorWorkflow(prompt, refName, denoise, faceLock) {
  const seed = Math.floor(Math.random() * 999999999999999);
  const p = (faceLock && refName) ? FACE_LOCK_PREFIX + prompt : prompt;
  const base = {
    '1':  { class_type: 'VAELoader',  inputs: { vae_name: 'qwen_image_vae.safetensors' } },
    '2':  { class_type: 'UNETLoader', inputs: { unet_name: 'krea2_turbo_fp8_scaled.safetensors', weight_dtype: 'default' } },
    '3':  { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_4b_bf16.safetensors', type: 'krea2' } },
    '4':  { class_type: 'LoraLoader', inputs: { model: ['2', 0],  clip: ['3', 0],  lora_name: 'saggy-krea-turbo.safetensors',                strength_model: 0.21, strength_clip: 0.21 } },
    '11': { class_type: 'LoraLoader', inputs: { model: ['4', 0],  clip: ['4', 1],  lora_name: 'snofs_krea_v1.safetensors',                   strength_model: 0.9,  strength_clip: 0.9  } },
    '12': { class_type: 'LoraLoader', inputs: { model: ['11', 0], clip: ['11', 1], lora_name: 'lenovo_krea2.safetensors',                    strength_model: 1.8,  strength_clip: 1.8  } },
    '13': { class_type: 'LoraLoader', inputs: { model: ['12', 0], clip: ['12', 1], lora_name: 'bloomgirls-ultrarealism-krea2_4k.safetensors', strength_model: 0.4,  strength_clip: 0.4  } },
    '14': { class_type: 'LoraLoader', inputs: { model: ['13', 0], clip: ['13', 1], lora_name: 'Krea2-realism-V2.safetensors',               strength_model: 1.0,  strength_clip: 1.0  } },
  };
  const { nodes: ln, ref } = refLatent(refName, '1', 576, 1024);
  const posNode = (faceLock && refName)
    ? { '7': { class_type: 'TextEncodeQwenImageEdit', inputs: { clip: ['14', 1], prompt: p, vae: ['1', 0], image: ['50', 0] } } }
    : { '7': { class_type: 'CLIPTextEncode', inputs: { text: p, clip: ['14', 1] } } };
  return { ...base, ...ln, ...posNode,
    '8':  { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['7', 0] } },
    '9':  { class_type: 'KSampler', inputs: { model: ['14', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ref, seed, control_after_generate: 'randomize', steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise } },
    '10': { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['1', 0] } },
    '15': { class_type: 'SaveImage', inputs: { images: ['10', 0], filename_prefix: '3Vector' } },
  };
}

function buildDarkBeastWorkflow(prompt, refName, faceLock) {
  const seed = Math.floor(Math.random() * 999999999999999);
  const p = (faceLock && refName) ? FACE_LOCK_PREFIX + prompt : prompt;
  const base = {
    '1':  { class_type: 'VAELoader',  inputs: { vae_name: 'krea2RealVae_v10.safetensors' } },
    '2':  { class_type: 'UNETLoader', inputs: { unet_name: 'darkBeastINT8Convrot2_krea211INT8Convrot.safetensors', weight_dtype: 'default' } },
    '3':  { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_4b_bf16.safetensors', type: 'krea2' } },
    '4':  { class_type: 'LoraLoader', inputs: { model: ['2', 0], clip: ['3', 0], lora_name: 'breast_size_krea2_loraholic.safetensors', strength_model: 1.0, strength_clip: 1.0 } },
    '5':  { class_type: 'LoraLoader', inputs: { model: ['4', 0], clip: ['4', 1], lora_name: 'ass_krea2_loraholic.safetensors',         strength_model: 1.0, strength_clip: 1.0 } },
    '6':  { class_type: 'LoraLoader', inputs: { model: ['5', 0], clip: ['5', 1], lora_name: 'KNPV4.1_pre.safetensors',                 strength_model: 1.0, strength_clip: 1.0 } },
  };
  const posNode = (faceLock && refName)
    ? { '50': { class_type: 'LoadImage',               inputs: { image: refName } },
        '7':  { class_type: 'TextEncodeQwenImageEdit',  inputs: { clip: ['6', 1], prompt: p, vae: ['1', 0], image: ['50', 0] } } }
    : { '7':  { class_type: 'CLIPTextEncode',           inputs: { text: p, clip: ['6', 1] } } };
  const { nodes: ln, ref } = refLatent((faceLock && refName) ? null : refName, '1', 576, 1024);
  return { ...base, ...posNode, ...ln,
    '8':  { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['7', 0] } },
    '10': { class_type: 'KSamplerAdvanced', inputs: { model: ['6', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ref,       noise_seed: seed, add_noise: 'enable',  steps: 10, cfg: 1, sampler_name: 'euler',        scheduler: 'simple',      start_at_step: 0,  end_at_step: 10,  return_with_leftover_noise: 'enable'  } },
    '11': { class_type: 'LatentUpscaleBy',   inputs: { samples: ['10', 0], upscale_method: 'bislerp', scale_by: 2.0 } },
    '12': { class_type: 'KSamplerAdvanced', inputs: { model: ['6', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['11', 0], noise_seed: seed, add_noise: 'disable', steps: 21, cfg: 1, sampler_name: 'dpmpp_2m_sde', scheduler: 'sgm_uniform', start_at_step: 11, end_at_step: 999, return_with_leftover_noise: 'disable' } },
    '13': { class_type: 'VAEDecode',        inputs: { samples: ['12', 0], vae: ['1', 0] } },
    '14': { class_type: 'SaveImage',        inputs: { images: ['13', 0], filename_prefix: 'DarkBeast' } },
  };
}

function buildFlux2Workflow(prompt, refName, denoise) {
  const seed = Math.floor(Math.random() * 999999999999999);
  const fullPrompt = `${prompt}, ${ANATOMY_SUFFIX}`;
  const d = refName ? (denoise || 0.75) : 1;
  const ln = refName
    ? { nodes: {
        '50': { class_type: 'LoadImage',  inputs: { image: refName } },
        '51': { class_type: 'ImageScale', inputs: { image: ['50', 0], upscale_method: 'lanczos', width: 1024, height: 1024, crop: 'disabled' } },
        '52': { class_type: 'VAEEncode',  inputs: { pixels: ['51', 0], vae: ['102', 0] } },
      }, ref: ['52', 0] }
    : { nodes: { '105': { class_type: 'EmptyFlux2LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } } }, ref: ['105', 0] };
  return {
    ...ln.nodes,
    '102': { class_type: 'VAELoader',           inputs: { vae_name: 'flux2-vae.safetensors' } },
    '126': { class_type: 'UNETLoader',          inputs: { unet_name: 'flux-2-klein-9b.safetensors', weight_dtype: 'default' } },
    '136': { class_type: 'CLIPLoaderGGUF',      inputs: { clip_name: 'flux2-klein-9b-uncensored-q8_0.gguf', type: 'flux2' } },
    '200': { class_type: 'LoraLoader',          inputs: { model: ['126', 0], clip: ['136', 0], lora_name: 'klein_snofs_v1_4.safetensors',   strength_model: 1.0, strength_clip: 1.0 } },
    '201': { class_type: 'LoraLoader',          inputs: { model: ['200', 0], clip: ['200', 1], lora_name: 'lenovo_flux_klein9b.safetensors', strength_model: 1.0, strength_clip: 1.0 } },
    '107': { class_type: 'CLIPTextEncode',      inputs: { text: fullPrompt, clip: ['201', 1] } },
    '100': { class_type: 'FluxGuidance',        inputs: { conditioning: ['107', 0], guidance: 4.0 } },
    '135': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['107', 0] } },
    '134': { class_type: 'KSampler',            inputs: { model: ['201', 0], positive: ['100', 0], negative: ['135', 0], latent_image: ln.ref, seed, control_after_generate: 'randomize', steps: 12, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: d } },
    '104': { class_type: 'VAEDecode',           inputs: { samples: ['134', 0], vae: ['102', 0] } },
    '9':   { class_type: 'SaveImage',           inputs: { images: ['104', 0], filename_prefix: 'Flux2' } },
  };
}

// ── API routes ───────────────────────────────────────────────────────────────

router.get('/images', async (req, res) => {
  try {
    const info = await comfyFetch('/object_info/LoadImage');
    const images = info.LoadImage.input.required.image[0].filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    res.json(images);
  } catch { res.json([]); }
});

router.get('/thumb/:filename', (req, res) => {
  const h = cfg.get('comfyui_host') || 'localhost';
  const p = parseInt(cfg.get('comfyui_port') || '8188');
  const r2 = http.get({ hostname: h, port: p, path: `/view?filename=${encodeURIComponent(req.params.filename)}&type=input` }, rs => {
    res.set('Content-Type', rs.headers['content-type'] || 'image/jpeg');
    rs.pipe(res);
  });
  r2.on('error', () => res.status(404).end());
});

router.get('/library', (req, res) => {
  const rows = db.prepare('SELECT id, positive FROM prompts ORDER BY created_at DESC LIMIT 100').all();
  res.json(rows);
});

router.post('/generate', async (req, res) => {
  const { prompt, model, referenceImage, denoise, faceLock } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt' });

  let refName = null;
  if (referenceImage) {
    try { refName = await uploadRef(referenceImage); }
    catch (e) { return res.status(500).json({ error: 'Ref upload failed: ' + e.message }); }
  }

  const d  = parseFloat(denoise) || 0.75;
  const fl = !!(faceLock && refName);
  let wf;
  switch (model) {
    case 'krea2full': wf = buildKrea2FullWorkflow(prompt, refName, d, fl); break;
    case 'darkbeast': wf = buildDarkBeastWorkflow(prompt, refName, fl); break;
    case '3vector':   wf = build3VectorWorkflow(prompt, refName, d, fl); break;
    case 'flux2':     wf = buildFlux2Workflow(prompt, refName, d); break;
    default:          wf = buildKrea2Workflow(prompt, refName, d, fl);
  }

  try {
    const result = await comfyFetch('/prompt', 'POST', { prompt: wf });
    res.json({ promptId: result.prompt_id });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.get('/status/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const history = await comfyFetch(`/history/${id}`);
    const job = history[id];
    if (job) {
      if (job.status?.completed) {
        const images = Object.values(job.outputs).flatMap(o => o.images || []);
        return res.json({ status: 'done', images });
      }
      if (job.status?.status_str === 'error') return res.json({ status: 'error' });
      return res.json({ status: 'running' });
    }
    const queue = await comfyFetch('/queue');
    const running  = (queue.queue_running  || []).find(item => item[1] === id);
    if (running) return res.json({ status: 'running', position: 0 });
    const pending  = queue.queue_pending   || [];
    const pos = pending.findIndex(item => item[1] === id);
    if (pos !== -1) return res.json({ status: 'queued', position: pos + 1, total: pending.length });
    res.json({ status: 'queued' });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// SSE endpoint — proxies ComfyUI WebSocket so browser gets live progress + preview frames
router.get('/watch/:id', (req, res) => {
  const { WebSocket } = require('ws');
  const id   = req.params.id;
  const h    = cfg.get('comfyui_host') || 'localhost';
  const p    = cfg.get('comfyui_port') || '8188';
  const wsUrl = `ws://${h}:${p}/ws?clientId=sp-${id.slice(0, 8)}`;

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();

  const send = (evt, data) => res.write(`event: ${evt}
data: ${JSON.stringify(data)}

`);
  send('connected', { id });

  const ws = new WebSocket(wsUrl);

  ws.on('message', async (msg) => {
    if (typeof msg === 'string' || msg instanceof Buffer && msg[0] === 123) {
      try {
        const obj = JSON.parse(typeof msg === 'string' ? msg : msg.toString());
        if (obj.data?.prompt_id && obj.data.prompt_id !== id) return;
        if (obj.type === 'progress')  send('progress', { value: obj.data.value, max: obj.data.max });
        if (obj.type === 'executing') send('executing', { node: obj.data.node });
        if (obj.type === 'executed' && obj.data.output?.images) {
          const imgs = obj.data.output.images;
          send('executed', { images: imgs });
          // fetch completion data then close
          try {
            const hist = await comfyFetch(`/history/${id}`);
            const job  = hist[id];
            if (job?.status?.completed) {
              const allImgs = Object.values(job.outputs).flatMap(o => o.images || []);
              send('done', { images: allImgs });
            }
          } catch {}
          ws.close();
          res.end();
        }
      } catch {}
    } else if (msg instanceof Buffer && msg.length > 8) {
      // binary preview frame: 8-byte header then JPEG bytes
      const jpeg = msg.slice(8);
      send('preview', { dataUrl: 'data:image/jpeg;base64,' + jpeg.toString('base64') });
    }
  });

  ws.on('error', () => { send('error', {}); res.end(); });
  ws.on('close', () => { try { res.end(); } catch {} });

  req.on('close', () => { try { ws.close(); } catch {} });
});

router.get('/view', async (req, res) => {
  const { filename, subfolder, type } = req.query;
  try {
    const r = await fetch(`${comfyUrl()}/view?filename=${encodeURIComponent(filename)}&subfolder=${subfolder || ''}&type=${type || 'output'}`);
    const buf = await r.arrayBuffer();
    res.set('Content-Type', r.headers.get('content-type') || 'image/png');
    res.send(Buffer.from(buf));
  } catch { res.status(500).end(); }
});

router.get('/recent', async (req, res) => {
  try {
    const history = await comfyFetch('/history?max_items=100');
    const images = [];
    for (const [promptId, job] of Object.entries(history)) {
      if (!job.status?.completed) continue;
      for (const img of Object.values(job.outputs).flatMap(o => o.images || [])) {
        if (img.type === 'output') images.push({ ...img, promptId });
      }
    }
    res.json(images.reverse().slice(0, 60));
  } catch { res.json([]); }
});

// ── Page ─────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Image Gen — SpicyPrompter</title>
<link rel="stylesheet" href="/prompts/public/style.css">
<style>
.ig-layout { display:grid; grid-template-columns:300px 1fr; gap:16px; height:calc(100vh - 120px); }
.ig-controls { display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding-right:4px; }
.ig-output { display:flex; flex-direction:column; gap:10px; overflow:hidden; }
.ctrl-section { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); padding:12px; }
.ctrl-label { font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; }
.ctrl-label span { font-family:var(--font-mono); color:var(--accent); font-size:10px; }
.ig-select { width:100%; background:var(--bg3); border:1px solid var(--border); color:var(--text); padding:6px 8px; border-radius:var(--radius); font-family:var(--font); font-size:12px; cursor:pointer; }
.ig-select:focus { outline:none; border-color:var(--accent); }
.ig-textarea { width:100%; background:var(--bg3); border:1px solid var(--border); color:var(--text); padding:8px; border-radius:var(--radius); font-family:var(--font); font-size:11px; resize:vertical; min-height:90px; box-sizing:border-box; }
.ig-textarea:focus { outline:none; border-color:var(--accent); }
.img-grid-sm { display:grid; grid-template-columns:repeat(auto-fill,minmax(70px,1fr)); gap:6px; max-height:200px; overflow-y:auto; }
.img-thumb-sm { position:relative; cursor:pointer; border-radius:3px; overflow:hidden; border:2px solid transparent; aspect-ratio:1; }
.img-thumb-sm img { width:100%; height:100%; object-fit:cover; display:block; }
.img-thumb-sm.selected { border-color:var(--accent); }
.img-thumb-sm .ck { position:absolute; top:2px; right:2px; background:var(--accent); color:#fff; border-radius:50%; width:14px; height:14px; font-size:8px; display:none; align-items:center; justify-content:center; }
.img-thumb-sm.selected .ck { display:flex; }
.range-row { display:flex; align-items:center; gap:8px; }
.range-row input[type=range] { flex:1; accent-color:var(--accent); }
.check-row { display:flex; align-items:center; gap:8px; cursor:pointer; }
.check-row input { accent-color:var(--accent); cursor:pointer; }
.check-row label { font-size:12px; color:var(--text); cursor:pointer; }
.gen-btn-full { width:100%; padding:10px; font-family:var(--font); font-weight:700; letter-spacing:.08em; font-size:12px; }
.output-canvas { flex:1; min-height:0; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
.output-canvas img { max-width:100%; max-height:100%; object-fit:contain; border-radius:var(--radius); }
.output-placeholder { color:var(--dim); font-size:12px; text-align:center; }
.status-bar { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); padding:8px 12px; font-size:11px; font-family:var(--font); color:var(--muted); display:flex; align-items:center; gap:8px; }
.status-dot { width:7px; height:7px; border-radius:50%; background:var(--border); flex-shrink:0; }
.status-dot.running { background:#ffa; animation:pulse .8s infinite; }
.status-dot.done { background:#6db86d; }
.status-dot.error { background:var(--accent); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.lib-btn { font-size:10px; padding:2px 8px; }
.lib-modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:100; align-items:center; justify-content:center; }
.lib-modal.open { display:flex; }
.lib-inner { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); width:600px; max-height:70vh; display:flex; flex-direction:column; overflow:hidden; }
.lib-head { padding:10px 14px; border-bottom:1px solid var(--border); font-size:12px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
.lib-list { overflow-y:auto; flex:1; }
.lib-item { padding:8px 14px; font-size:11px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,.05); line-height:1.5; }
.lib-item:hover { background:rgba(255,255,255,.04); color:var(--accent); }
.recent-strip { flex-shrink:0; }
.recent-label { font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:6px; }
.recent-scroll { display:flex; gap:8px; overflow-x:auto; padding-bottom:6px; }
.recent-scroll::-webkit-scrollbar { height:4px; }
.recent-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
.recent-thumb { flex-shrink:0; width:90px; height:90px; border-radius:3px; overflow:hidden; cursor:pointer; border:2px solid transparent; position:relative; }
.recent-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.recent-thumb:hover { border-color:var(--muted); }
.recent-thumb.active { border-color:var(--accent); }
</style>
</head>
<body>
<div class="app-layout">
  <aside class="sidebar">
    <a href="/prompts" class="sidebar-brand">
      <img src="/prompts/public/logo.png" alt="SpicyPrompter">
    </a>
    <nav class="sidebar-nav">
      <a href="/prompts" class="sidebar-link" data-path="/prompts">Library</a>
      <a href="/prompts/generate" class="sidebar-link" data-path="/prompts/generate">Generate</a>
      <a href="/prompts/categories" class="sidebar-link" data-path="/prompts/categories">Categories</a>
      <a href="/prompts/imagegen" class="sidebar-link" data-path="/prompts/imagegen">Image Gen</a>
      <a href="/prompts/settings" class="sidebar-link" data-path="/prompts/settings">Settings</a>
    </nav>
  </aside>
  <main class="app-main">
    <div class="page-header"><h1>Image Gen</h1></div>
    <div class="ig-layout">

      <div class="ig-controls">

        <div class="ctrl-section">
          <div class="ctrl-label">Model</div>
          <select class="ig-select" id="model">
            <option value="krea2">Krea-2 Turbo (snofs)</option>
            <option value="krea2full">Krea-2 Full (5 LoRAs)</option>
            <option value="darkbeast">Dark Beast</option>
            <option value="3vector">3 Vector</option>
            <option value="flux2">Flux.2 Klein</option>
          </select>
        </div>

        <div class="ctrl-section">
          <div class="ctrl-label">
            Prompt
            <button class="btn btn-secondary lib-btn" onclick="openLib()">From Library</button>
          </div>
          <textarea class="ig-textarea" id="prompt" placeholder="Beautiful woman in a sunlit bedroom..."></textarea>
        </div>

        <div class="ctrl-section">
          <div class="ctrl-label">Reference Image <span id="ref-name-display">none</span></div>
          <div class="img-grid-sm" id="ref-grid"></div>
          <div style="margin-top:8px">
            <button class="btn btn-secondary" style="font-size:10px;padding:3px 8px" onclick="clearRef()">Clear ref</button>
          </div>
        </div>

        <div class="ctrl-section">
          <div class="ctrl-label">Denoise <span id="denoise-val">0.75</span></div>
          <div class="range-row">
            <input type="range" id="denoise" min="0.1" max="1.0" step="0.05" value="0.75"
              oninput="document.getElementById('denoise-val').textContent=parseFloat(this.value).toFixed(2)">
          </div>
          <div style="font-size:10px;color:var(--dim);margin-top:4px">Only applies when a reference image is selected.</div>
        </div>

        <div class="ctrl-section">
          <div class="check-row">
            <input type="checkbox" id="facelockCb">
            <label for="facelockCb">Face Lock</label>
          </div>
          <div style="font-size:10px;color:var(--dim);margin-top:4px">Preserves identity from reference image.</div>
        </div>

        <button class="btn btn-primary gen-btn-full" id="genBtn" onclick="generate()">&#9654; Generate</button>

      </div>

      <div class="ig-output">
        <div class="output-canvas" id="outputCanvas">
          <div class="output-placeholder" id="outputPlaceholder">
            <div style="font-size:28px;margin-bottom:8px;opacity:.25">&#128444;</div>
            Output appears here
          </div>
          <img id="outputImg" style="display:none" alt="Generated">
        </div>
        <div class="status-bar">
          <div class="status-dot" id="statusDot"></div>
          <span id="statusText">Ready</span>
        </div>
        <div>
          <a id="dlLink" class="btn btn-secondary" style="display:none;font-size:11px;padding:5px 12px" download="spicyprompter.png">Download</a>
        </div>
        <div class="recent-strip">
          <div class="recent-label">Recent Outputs <span id="recent-count" style="color:var(--dim)"></span></div>
          <div class="recent-scroll" id="recentScroll"></div>
        </div>
      </div>

    </div>
  </main>
</div>

<div class="lib-modal" id="libModal" onclick="if(event.target===this)closeLib()">
  <div class="lib-inner">
    <div class="lib-head">
      <span>Pick from Library</span>
      <button class="btn btn-secondary" style="font-size:11px;padding:2px 8px" onclick="closeLib()">&#x2715;</button>
    </div>
    <div class="lib-list" id="libList"></div>
  </div>
</div>

<script>
let selectedRef = null;

function setStatus(text, state) {
  document.getElementById('statusText').textContent = text;
  document.getElementById('statusDot').className = 'status-dot' + (state ? ' ' + state : '');
}

async function loadImages() {
  try {
    const imgs = await fetch('/prompts/imagegen/images').then(r => r.json());
    const grid = document.getElementById('ref-grid');
    grid.innerHTML = '';
    imgs.forEach(name => {
      const d = document.createElement('div');
      d.className = 'img-thumb-sm';
      d.dataset.name = name;
      d.innerHTML = '<img src="/prompts/imagegen/thumb/' + encodeURIComponent(name) + '" loading="lazy" title="' + name + '"><span class="ck">&#10003;</span>';
      d.onclick = () => selectRef(name, d);
      grid.appendChild(d);
    });
  } catch(e) {}
}

function selectRef(name, el) {
  document.querySelectorAll('.img-thumb-sm').forEach(t => t.classList.remove('selected'));
  if (selectedRef === name) {
    selectedRef = null;
    document.getElementById('ref-name-display').textContent = 'none';
  } else {
    selectedRef = name;
    el.classList.add('selected');
    document.getElementById('ref-name-display').textContent = name.length > 22 ? name.slice(0, 22) + '…' : name;
  }
}

function clearRef() {
  selectedRef = null;
  document.querySelectorAll('.img-thumb-sm').forEach(t => t.classList.remove('selected'));
  document.getElementById('ref-name-display').textContent = 'none';
}

async function generate() {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) { setStatus('Enter a prompt', 'error'); return; }
  const model    = document.getElementById('model').value;
  const denoise  = parseFloat(document.getElementById('denoise').value);
  const faceLock = document.getElementById('facelockCb').checked;

  document.getElementById('genBtn').disabled = true;
  document.getElementById('dlLink').style.display = 'none';
  setStatus('Submitting…', 'running');

  let referenceImage = null;
  if (selectedRef) {
    try {
      const r   = await fetch('/prompts/imagegen/view?filename=' + encodeURIComponent(selectedRef) + '&type=input');
      const buf = await r.arrayBuffer();
      const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
      referenceImage = 'data:image/jpeg;base64,' + b64;
    } catch(e) {
      setStatus('Failed to load ref: ' + e.message, 'error');
      document.getElementById('genBtn').disabled = false;
      return;
    }
  }

  try {
    const body = JSON.stringify({ prompt, model, referenceImage, denoise, faceLock });
    const r    = await fetch('/prompts/imagegen/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const d    = await r.json();
    if (d.error) { setStatus('Error: ' + d.error, 'error'); document.getElementById('genBtn').disabled = false; return; }
    setStatus('Queued…', 'running');
    watchJob(d.promptId);
  } catch(e) {
    setStatus('Error: ' + e.message, 'error');
    document.getElementById('genBtn').disabled = false;
  }
}

let activeSSE = null;
let jobDone   = false;

function showImage(url, fromGallery) {
  const el = document.getElementById('outputImg');
  el.src   = url;
  el.style.display = 'block';
  document.getElementById('outputPlaceholder').style.display = 'none';
  const dl = document.getElementById('dlLink');
  dl.href  = url;
  dl.style.display = '';
  if (!fromGallery) document.querySelectorAll('.recent-thumb').forEach(t => t.classList.remove('active'));
}

function markDone(images) {
  if (jobDone) return;
  jobDone = true;
  if (activeSSE) { activeSSE.close(); activeSSE = null; }
  if (images && images.length) {
    const img = images[0];
    const url = '/prompts/imagegen/view?filename=' + encodeURIComponent(img.filename) + '&subfolder=' + (img.subfolder || '') + '&type=' + (img.type || 'output');
    showImage(url);
  }
  setStatus('Done', 'done');
  document.getElementById('genBtn').disabled = false;
  loadRecent();
}

function watchJob(id) {
  jobDone = false;
  if (activeSSE) { activeSSE.close(); activeSSE = null; }

  // SSE/WebSocket: live step previews
  const es = new EventSource('/prompts/imagegen/watch/' + id);
  activeSSE = es;

  es.addEventListener('progress', e => {
    if (jobDone) return;
    const d = JSON.parse(e.data);
    setStatus('Step ' + d.value + ' / ' + d.max, 'running');
  });

  es.addEventListener('preview', e => {
    if (jobDone) return;
    const d = JSON.parse(e.data);
    const el = document.getElementById('outputImg');
    el.src   = d.dataUrl;
    el.style.display = 'block';
    document.getElementById('outputPlaceholder').style.display = 'none';
  });

  es.addEventListener('done', e => {
    es.close(); activeSSE = null;
    markDone(JSON.parse(e.data).images);
  });

  es.onerror = () => { es.close(); activeSSE = null; };

  // HTTP polling runs in parallel — guarantees completion is detected
  pollStatus(id);
}

async function pollStatus(id) {
  if (jobDone) return;
  try {
    const d = await fetch('/prompts/imagegen/status/' + id).then(r => r.json());
    if (jobDone) return;
    if (d.status === 'done' && d.images && d.images.length) {
      markDone(d.images);
    } else if (d.status === 'error') {
      setStatus('ComfyUI error', 'error');
      document.getElementById('genBtn').disabled = false;
    } else {
      if (d.status === 'queued' && d.position) {
        setStatus('Queue position: ' + d.position + ' of ' + (d.total || '?'), 'running');
      }
      setTimeout(() => pollStatus(id), 2000);
    }
  } catch(e) {
    setTimeout(() => pollStatus(id), 3000);
  }
}

async function openLib() {
  document.getElementById('libModal').classList.add('open');
  const list = document.getElementById('libList');
  list.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--muted)">Loading…</div>';
  const rows = await fetch('/prompts/imagegen/library').then(r => r.json());
  list.innerHTML = rows.map(p => {
    const preview = p.positive.slice(0, 160) + (p.positive.length > 160 ? '…' : '');
    const escaped = p.positive.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="lib-item" onclick="pickPrompt(\\'' + escaped + '\\')">' + preview + '</div>';
  }).join('');
}

function pickPrompt(text) {
  document.getElementById('prompt').value = text;
  closeLib();
}

function closeLib() {
  document.getElementById('libModal').classList.remove('open');
}

loadImages();
loadRecent();

async function loadRecent() {
  try {
    const imgs = await fetch('/prompts/imagegen/recent').then(r => r.json());
    const strip = document.getElementById('recentScroll');
    const count = document.getElementById('recent-count');
    if (!imgs.length) { count.textContent = '(none yet)'; return; }
    count.textContent = '(' + imgs.length + ')';
    strip.innerHTML = '';
    imgs.forEach(img => {
      const url = '/prompts/imagegen/view?filename=' + encodeURIComponent(img.filename) + '&subfolder=' + (img.subfolder || '') + '&type=' + (img.type || 'output');
      const d = document.createElement('div');
      d.className = 'recent-thumb';
      d.dataset.url = url;
      d.innerHTML = '<img src="' + url + '" loading="lazy" title="' + img.filename + '">';
      d.onclick = () => {
        document.querySelectorAll('.recent-thumb').forEach(t => t.classList.remove('active'));
        d.classList.add('active');
        showImage(url, true);
        document.getElementById('dlLink').href = url;
        document.getElementById('dlLink').style.display = '';
        setStatus('Loaded from history', 'done');
      };
      strip.appendChild(d);
    });
  } catch(e) {}
}
</script>
</body>
</html>`);
});

module.exports = router;
