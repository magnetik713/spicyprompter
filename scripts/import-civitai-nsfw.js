#!/usr/bin/env node
// Fetch NSFW image prompts from Civitai (Pony + Flux.1 D) and import into prompts.db
// Usage: node scripts/import-civitai-nsfw.js [--limit 500]

const db = require('../db');

const TARGET = parseInt(process.argv[2] === '--limit' ? process.argv[3] : '500');
const BASE_URL = 'https://civitai.com/api/v1/images';
const NSFW_MODELS = new Set(['Flux.1 D', 'Pony', 'SDXL 1.0', 'Illustrious']);
const PONY_PATTERN = /\b(score_\d+(_up)?|source_(anime|furry|cartoon|pony|real)|rating_(safe|explicit|questionable|e))\b,?\s*/gi;

function stripPonyTags(text, baseModel) {
  if (!text || baseModel === 'Pony') return text;
  return text.replace(PONY_PATTERN, '').replace(/,\s*,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').trim();
}

const insert = db.prepare(`
  INSERT INTO prompts (name, base_model, positive, negative, tags, notes, seed, width, height, steps, cfg_scale, sampler)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((rows) => {
  let count = 0;
  for (const row of rows) {
    insert.run(row.name, row.base_model, row.positive, row.negative, row.tags, row.notes,
               row.seed, row.width, row.height, row.steps, row.cfg_scale, row.sampler);
    count++;
  }
  return count;
});

function makeName(prompt) {
  if (!prompt) return 'Untitled';
  const first = prompt.replace(/\s+/g, ' ').trim().slice(0, 60);
  return first.length < prompt.trim().length ? first + '…' : first;
}

async function fetchPage(cursor) {
  const params = new URLSearchParams({
    limit: 100,
    sort: 'Most Reactions',
    period: 'AllTime',
    nsfw: 'true',
  });
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Civitai API error: ${res.status}`);
  return res.json();
}

async function main() {
  let cursor = null;
  let total = 0;
  let fetched = 0;

  console.log(`Importing up to ${TARGET} NSFW prompts from Civitai...`);

  while (total < TARGET) {
    const data = await fetchPage(cursor);
    const items = data.items || [];
    if (!items.length) break;

    fetched += items.length;

    const rows = items
      .filter(img => img.nsfw === true && NSFW_MODELS.has(img.baseModel) && img.meta?.prompt)
      .map(img => {
        const m = img.meta;
        let width = null, height = null;
        if (m.Size) { const [w, h] = m.Size.split('x').map(Number); width = w || null; height = h || null; }
        return {
          name: makeName(m.prompt),
          base_model: img.baseModel,
          positive: stripPonyTags(m.prompt, img.baseModel),
          negative: stripPonyTags(m.negativePrompt || null, img.baseModel),
          tags: 'adult',
          notes: `Source: ${img.url}`,
          seed: m.seed || null,
          width,
          height,
          steps: m.steps || null,
          cfg_scale: m.cfgScale || null,
          sampler: m.sampler || null,
        };
      });

    if (rows.length) {
      const added = insertMany(rows);
      total += added;
      console.log(`  Fetched ${fetched} images, imported ${total} NSFW prompts...`);
    }

    cursor = data.metadata?.nextCursor;
    if (!cursor) break;

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`Done. ${total} NSFW prompts imported.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
