const express = require('express');
const router = express.Router();
const http = require('http');

const cfg = require('../config');
const COMFY_HOST = cfg.get('comfyui_host') || 'localhost';
const COMFY_PORT = parseInt(cfg.get('comfyui_port') || '8188');

function comfyFetch(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: COMFY_HOST, port: COMFY_PORT, path, method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildWorkflow(scene, image1, image2, seed) {
  return {
    "1":  { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "Qwen-Rapid-AIO-NSFW-v23.safetensors" } },
    "7":  { class_type: "LoadImage", inputs: { image: image1 } },
    "8":  { class_type: "LoadImage", inputs: { image: image2 } },
    "30": { class_type: "ImageResizeKJv2", inputs: { image: ["7",0], width: 1024, height: 1024, upscale_method: "lanczos", keep_proportion: "resize", pad_color: "0, 0, 0", crop_position: "center", divisible_by: 2, device: "cpu" } },
    "36": { class_type: "ImageResizeKJv2", inputs: { image: ["8",0], width: 480, height: 832, upscale_method: "lanczos", keep_proportion: "resize", pad_color: "0, 0, 0", crop_position: "center", divisible_by: 2, device: "cpu" } },
    "16": { class_type: "easy imageSize", inputs: { image: ["30",0] } },
    "9":  { class_type: "EmptyLatentImage", inputs: { width: ["16",0], height: ["16",1], batch_size: 1 } },
    "3":  { class_type: "TextEncodeQwenImageEditPlus", inputs: { clip: ["1",1], vae: ["1",2], image1: ["30",0], image2: ["36",0], prompt: `same face as reference image, identical facial features, preserve identity normal proportions\n\n${scene}` } },
    "4":  { class_type: "TextEncodeQwenImageEditPlus", inputs: { clip: ["1",1], vae: ["1",2], prompt: "" } },
    "2":  { class_type: "KSampler", inputs: { model: ["1",0], positive: ["3",0], negative: ["4",0], latent_image: ["9",0], seed, steps: 5, cfg: 1, sampler_name: "res_2s", scheduler: "beta", denoise: 1 } },
    "24": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "23": { class_type: "DetailDaemonSamplerNode", inputs: { sampler: ["24",0], detail_amount: 0.1, start: 0.2, end: 0.8, bias: 0.5, exponent: 1, start_offset: 0, end_offset: 0, fade: 0, smooth: false, cfg_scale_override: 0 } },
    "26": { class_type: "RandomNoise", inputs: { noise_seed: seed + 1 } },
    "27": { class_type: "CFGGuider", inputs: { model: ["1",0], positive: ["3",0], negative: ["4",0], cfg: 1 } },
    "28": { class_type: "BasicScheduler", inputs: { model: ["1",0], scheduler: "simple", steps: 7, denoise: 0.7 } },
    "25": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["26",0], guider: ["27",0], sampler: ["23",0], sigmas: ["28",0], latent_image: ["2",0] } },
    "29": { class_type: "VAEDecode", inputs: { samples: ["25",0], vae: ["1",2] } },
    "32": { class_type: "SeedVR2LoadDiTModel", inputs: { model: "seedvr2_ema_7b-Q8_K_M.gguf", device: "cuda:0", blocks_to_swap: 0, swap_io_components: false, offload_device: "cpu", cache_model: true, attention_mode: "sageattn_2" } },
    "33": { class_type: "SeedVR2LoadVAEModel", inputs: { model: "ema_vae_fp16.safetensors", device: "cuda:0", offload_device: "cpu", cache_model: true, encode_tiled: false, encode_tile_size: 1024, encode_tile_overlap: 128, decode_tiled: false, decode_tile_size: 1024, decode_tile_overlap: 128, tile_debug: "false" } },
    "31": { class_type: "SeedVR2VideoUpscaler", inputs: { image: ["29",0], dit: ["32",0], vae: ["33",0], seed: 3250534716, resolution: 1024, max_resolution: 0, batch_size: 1, uniform_batch_size: false, color_correction: "lab", temporal_overlap: 0, prepend_frames: 0, input_noise_scale: 0, latent_noise_scale: 0, offload_device: "cpu", enable_debug: false } },
    "50": { class_type: "SaveImage", inputs: { filename_prefix: "generate/output", images: ["31",0] } },
  };
}

// Image list
router.get('/images', async (req, res) => {
  try {
    const info = await comfyFetch('/object_info/LoadImage');
    const images = info.LoadImage.input.required.image[0].filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    res.json(images);
  } catch (e) {
    res.json(['pc130014.jpg', 'pc130004.jpg']);
  }
});

// Proxy thumbnails from ComfyUI input folder
router.get('/thumb/:filename', (req, res) => {
  const comfyReq = http.get({
    hostname: COMFY_HOST, port: COMFY_PORT,
    path: `/view?filename=${encodeURIComponent(req.params.filename)}&type=input`,
  }, comfyRes => {
    res.set('Content-Type', comfyRes.headers['content-type'] || 'image/jpeg');
    comfyRes.pipe(res);
  });
  comfyReq.on('error', () => res.status(404).end());
});

// Submit
router.post('/submit', async (req, res) => {
  const { scene, image1, image2 } = req.body;
  if (!image1 || !image2 || !scene) return res.status(400).json({ error: 'Missing fields' });
  const seed = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildWorkflow(scene, image1, image2, seed);
  try {
    const result = await comfyFetch('/prompt', 'POST', JSON.stringify({ prompt: workflow }));
    res.json({ promptId: result.prompt_id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Status
router.get('/status/:id', async (req, res) => {
  try {
    const history = await comfyFetch(`/history/${req.params.id}`);
    const job = history[req.params.id];
    if (!job) return res.json({ status: 'queued' });
    const s = job.status || {};
    if (s.completed) return res.json({ status: 'done' });
    if (s.status_str === 'error') {
      const e = (s.messages || []).find(m => m[0] === 'execution_error');
      return res.json({ status: 'error', message: e ? e[1].exception_message : 'Unknown error' });
    }
    res.json({ status: 'running' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Main page — inline HTML, no template needed
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Generate — ComfyUI Prompts</title>
<link rel="stylesheet" href="/prompts/public/style.css">
<style>
.gen-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.ref-panel h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--dim); margin-bottom: 10px; }
.img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; max-height: 420px; overflow-y: auto; padding-right: 4px; }
.img-thumb { position: relative; cursor: pointer; border-radius: 4px; overflow: hidden; border: 2px solid transparent; aspect-ratio: 1; }
.img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.img-thumb.selected { border-color: var(--accent); }
.img-thumb .check { position: absolute; top: 4px; right: 4px; background: var(--accent); color: #fff; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; display: none; align-items: center; justify-content: center; }
.img-thumb.selected .check { display: flex; }
.selected-preview { margin-top: 10px; height: 120px; background: var(--bg2); border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; color: var(--dim); font-size: 11px; border: 1px solid #333; }
.selected-preview img { height: 100%; object-fit: contain; }
.prompt-section { grid-column: 1 / -1; }
.prompt-section textarea { width: 100%; background: var(--bg2); border: 1px solid #333; color: var(--text); padding: 10px; border-radius: var(--radius); font-family: var(--font); font-size: 12px; resize: vertical; min-height: 100px; }
.prompt-section textarea:focus { outline: none; border-color: var(--accent); }
.submit-row { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; }
#status { font-size: 12px; color: var(--dim); }
#status.running { color: #ffa; }
#status.done { color: #8f8; }
#status.error { color: var(--accent); }
.loading-dots::after { content: '...'; animation: dots 1.2s steps(4, end) infinite; }
@keyframes dots { 0%,20%{content:'.'} 40%{content:'..'} 60%,100%{content:'...'} }
</style>
</head>
<body>
<nav class="nav">
  <a href="/prompts" class="nav-brand">ComfyUI Prompts</a>
  <a href="/prompts">Library</a>
  <a href="/prompts/workflows">Workflows</a>
  <a href="/prompts/generate" class="btn-accent">Generate</a>
</nav>
<main>
  <div class="page-header"><h1>Generate</h1></div>
  <div class="gen-layout">
    <div class="ref-panel">
      <h3>Top reference (image1 — 1024×1024)</h3>
      <div class="img-grid" id="grid1"></div>
      <div class="selected-preview" id="preview1"><span>None selected</span></div>
    </div>
    <div class="ref-panel">
      <h3>Bottom reference (image2 — 480×832)</h3>
      <div class="img-grid" id="grid2"></div>
      <div class="selected-preview" id="preview2"><span>None selected</span></div>
    </div>
    <div class="prompt-section">
      <div class="section-label" style="margin-bottom:6px">Scene description</div>
      <textarea id="scene" placeholder="young woman astronaut in NASA spacesuit, helmet off, inside space station, dramatic lighting, photorealistic portrait"></textarea>
    </div>
    <div class="submit-row">
      <button class="btn btn-primary" id="submitBtn" onclick="submitJob()">Generate</button>
      <span id="status"></span>
    </div>
  </div>
</main>
<script>
let sel1 = null, sel2 = null;

function makeGrid(images, gridId, slot) {
  const grid = document.getElementById(gridId);
  images.forEach(name => {
    const div = document.createElement('div');
    div.className = 'img-thumb';
    div.dataset.name = name;
    div.innerHTML = \`<img src="/prompts/generate/thumb/\${encodeURIComponent(name)}" loading="lazy" title="\${name}"><span class="check">✓</span>\`;
    div.onclick = () => selectImage(name, slot);
    grid.appendChild(div);
  });
}

function selectImage(name, slot) {
  const gridId = slot === 1 ? 'grid1' : 'grid2';
  const previewId = slot === 1 ? 'preview1' : 'preview2';
  document.querySelectorAll('#' + gridId + ' .img-thumb').forEach(el => {
    el.classList.toggle('selected', el.dataset.name === name);
  });
  document.getElementById(previewId).innerHTML = \`<img src="/prompts/generate/thumb/\${encodeURIComponent(name)}">\`;
  if (slot === 1) sel1 = name; else sel2 = name;
}

async function submitJob() {
  if (!sel1 || !sel2) { setStatus('Select both reference images', ''); return; }
  const scene = document.getElementById('scene').value.trim();
  if (!scene) { setStatus('Enter a scene description', ''); return; }
  document.getElementById('submitBtn').disabled = true;
  setStatus('Submitting<span class="loading-dots"></span>', 'running');
  try {
    const r = await fetch('/prompts/generate/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene, image1: sel1, image2: sel2 })
    });
    const { promptId, error } = await r.json();
    if (error) { setStatus('Error: ' + error, 'error'); document.getElementById('submitBtn').disabled = false; return; }
    setStatus('Running<span class="loading-dots"></span>', 'running');
    pollStatus(promptId);
  } catch (e) {
    setStatus('Error: ' + e, 'error');
    document.getElementById('submitBtn').disabled = false;
  }
}

async function pollStatus(id) {
  const r = await fetch('/prompts/generate/status/' + id);
  const { status, message } = await r.json();
  if (status === 'done') {
    setStatus('Done — check ComfyUI output folder', 'done');
    document.getElementById('submitBtn').disabled = false;
  } else if (status === 'error') {
    setStatus('Error: ' + message, 'error');
    document.getElementById('submitBtn').disabled = false;
  } else {
    setTimeout(() => pollStatus(id), 4000);
  }
}

function setStatus(html, cls) {
  const el = document.getElementById('status');
  el.innerHTML = html;
  el.className = cls;
}

fetch('/prompts/generate/images').then(r => r.json()).then(images => {
  makeGrid(images, 'grid1', 1);
  makeGrid(images, 'grid2', 2);
  // Default selections
  const first = images[0], second = images[1] || images[0];
  if (first) selectImage(first, 1);
  if (second) selectImage(second, 2);
});
</script>
</body>
</html>`);
});

module.exports = router;
