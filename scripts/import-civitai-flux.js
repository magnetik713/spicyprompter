#!/usr/bin/env node
// Fetch Flux.1 D image prompts from Civitai and import into prompts.db
// Usage: node scripts/import-civitai-flux.js [--limit 500]

const db = require('../db');

const TARGET = parseInt(process.argv[2] === '--limit' ? process.argv[3] : '500');
const BASE_URL = 'https://civitai.com/api/v1/images';

const insert = db.prepare(`
  INSERT INTO prompts (name, base_model, positive, negative, tags, notes, category, seed, width, height, steps, cfg_scale, sampler)
  VALUES (?, 'FLUX.1', ?, ?, ?, ?, 'public', ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((rows) => {
  let count = 0;
  for (const row of rows) {
    insert.run(row.name, row.positive, row.negative, row.tags, row.notes,
               row.seed, row.width, row.height, row.steps, row.cfg_scale, row.sampler);
    count++;
  }
  return count;
});

const CATEGORIES = [
  { tag: 'portrait',      terms: ['portrait', '1girl', '1boy', '1person', 'face', 'headshot', 'close-up face', 'bust', 'solo'] },
  { tag: 'fantasy',       terms: ['fantasy', 'dragon', 'magic', 'elf', 'wizard', 'sorcerer', 'spell', 'mythical', 'dwarf', 'orc', 'dungeon'] },
  { tag: 'sci-fi',        terms: ['sci-fi', 'cyberpunk', 'robot', 'android', 'cyborg', 'space', 'futuristic', 'neon', 'hologram', 'spaceship', 'mech'] },
  { tag: 'landscape',     terms: ['landscape', 'mountain', 'forest', 'ocean', 'beach', 'river', 'valley', 'scenery', 'nature', 'wilderness', 'field', 'sky'] },
  { tag: 'architecture',  terms: ['architecture', 'building', 'city', 'urban', 'skyscraper', 'cathedral', 'castle', 'interior', 'room', 'street', 'alley'] },
  { tag: 'anime',         terms: ['anime', 'manga', 'chibi', 'waifu', 'moe', 'kawaii'] },
  { tag: 'cinematic',     terms: ['cinematic', 'film', 'movie', 'dramatic lighting', 'depth of field', 'bokeh', 'volumetric'] },
  { tag: 'photorealistic',terms: ['photorealistic', 'photograph', 'photo', 'realistic', 'raw photo', 'dslr', 'canon', 'nikon'] },
  { tag: 'animal',        terms: ['wolf', 'cat', 'dog', 'lion', 'tiger', 'bird', 'horse', 'fox', 'bear', 'deer', 'animal', 'wildlife', 'creature'] },
  { tag: 'abstract',      terms: ['abstract', 'surreal', 'psychedelic', 'fractal', 'geometric', 'pattern', 'dreamlike'] },
  { tag: 'vehicle',       terms: ['car', 'motorcycle', 'spaceship', 'aircraft', 'train', 'ship', 'vehicle', 'truck', 'ferrari', 'lamborghini'] },
];

function classify(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();
  const matched = CATEGORIES.filter(c => c.terms.some(t => lower.includes(t))).map(c => c.tag);
  return matched.length ? matched.join(', ') : null;
}

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
    nsfw: 'false',
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

  console.log(`Importing up to ${TARGET} Flux.1 D prompts from Civitai...`);

  while (total < TARGET) {
    const data = await fetchPage(cursor);
    const items = data.items || [];
    if (!items.length) break;

    fetched += items.length;

    const rows = items
      .filter(img => img.baseModel === 'Flux.1 D' && img.meta?.prompt)
      .map(img => {
        const m = img.meta;
        let width = null, height = null;
        if (m.Size) { const [w, h] = m.Size.split('x').map(Number); width = w || null; height = h || null; }
        return {
          name: makeName(m.prompt),
          positive: m.prompt,
          negative: m.negativePrompt || null,
          tags: classify(m.prompt),
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
      console.log(`  Fetched ${fetched} images, imported ${total} Flux prompts...`);
    }

    cursor = data.metadata?.nextCursor;
    if (!cursor) break;

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`Done. ${total} Flux.1 D prompts imported.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
