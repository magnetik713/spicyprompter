#!/usr/bin/env node
// civitai → prompts.db scraper
// Usage: node civitai_scraper.js [--pages 5] [--nsfw X] [--sort "Most Reactions"]
//                                [--modelId 2723583,2724771] [--baseModel "SDXL 1.0"]
//                                [--require "candid,outdoor"] [--exclude "anime,cartoon"]

const Database = require('better-sqlite3');
const path = require('path');

const API_KEY = 'c807d1bc6423de0541772deb2f02fa6b';
const DB_PATH = path.join(__dirname, '..', 'prompts.db');

const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i+1] : def; };
const splitKw  = s => s ? s.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : [];

const PAGES      = parseInt(getArg('--pages', '5'));
const NSF_LVL    = getArg('--nsfw', 'X');
const SORT       = getArg('--sort', 'Most Reactions');
const BASE_MODEL = getArg('--baseModel', null);
const MODEL_IDS  = getArg('--modelId', null)?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const REQUIRE_KW = splitKw(getArg('--require', null));   // any match passes
const EXCLUDE_KW = splitKw(getArg('--exclude', null));   // any match fails

// Known models — add/edit as needed
const KNOWN_MODELS = {
  'krea2-turbo-fp8':  2723583,
  'krea2-turbo-int8': 2724771,
  'dark-beast':       2749127,
  'flux2-klein':      2322332,
  'flux2-klein-fp8':  2363950,
};

const ANIME_MODEL_KEYS  = ['pony','anime','hentai','waifu','nai','illustrious','noobai','animagine','novelai'];
const ANIME_PROMPT_KEYS = ['score_9','score_8_up','score_7_up','1girl, solo','anime style','manga','illustration,','flat color','2d, ','chibi'];
const REAL_SIGNALS      = ['photo','realistic','candid','raw photo','dslr','natural light','skin texture','film grain','bokeh','cinematic','hyperrealistic'];

function passesFilters(item) {
  const meta = item.meta;
  if (!meta?.prompt || meta.prompt.length < 30) return false;
  const p = meta.prompt.toLowerCase();
  const m = (meta.Model ?? '').toLowerCase();

  // anime check (skip when model-scoped)
  if (!MODEL_IDS) {
    if (ANIME_MODEL_KEYS.some(k => m.includes(k))) return false;
    if (ANIME_PROMPT_KEYS.some(k => p.includes(k))) return false;
  }

  // realistic check (skip when model-scoped or --require overrides it)
  if (!MODEL_IDS && REQUIRE_KW.length === 0) {
    if (!REAL_SIGNALS.some(k => p.includes(k))) return false;
  }

  // --require: prompt must contain at least one keyword
  if (REQUIRE_KW.length > 0 && !REQUIRE_KW.some(k => p.includes(k))) return false;

  // --exclude: prompt must not contain any keyword
  if (EXCLUDE_KW.length > 0 && EXCLUDE_KW.some(k => p.includes(k))) return false;

  return true;
}

function parseSize(sizeStr) {
  if (!sizeStr) return { width: null, height: null };
  const m = sizeStr.match(/(\d+)\s*[x×]\s*(\d+)/i);
  return m ? { width: parseInt(m[1]), height: parseInt(m[2]) } : { width: null, height: null };
}

async function fetchPage(modelId, cursor) {
  const url = new URL('https://civitai.com/api/v1/images');
  url.searchParams.set('limit', '100');
  url.searchParams.set('nsfw', modelId ? 'true' : NSF_LVL);
  if (!modelId) url.searchParams.set('withMeta', 'true');
  url.searchParams.set('sort', SORT);
  if (modelId)    url.searchParams.set('modelId', modelId);
  if (BASE_MODEL) url.searchParams.set('baseModel', BASE_MODEL);
  if (cursor)     url.searchParams.set('cursor', cursor);
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${API_KEY}` } });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

async function scrapeModel(db, insert, exists, modelId, label) {
  let cursor = null;
  let totalFetched = 0, totalInserted = 0;

  const kwTag = [
    ...(REQUIRE_KW.length ? [`req:${REQUIRE_KW.join('|')}`] : []),
    ...(EXCLUDE_KW.length ? [`exc:${EXCLUDE_KW.join('|')}`] : []),
  ].join(' ');
  const tag = [label ?? 'realistic', 'nsfw', 'civitai', kwTag].filter(Boolean).join(',');

  for (let page = 0; page < PAGES; page++) {
    process.stdout.write(`  Page ${page+1}/${PAGES}... `);
    const data = await fetchPage(modelId, cursor);
    const items = data.items ?? [];
    totalFetched += items.length;

    let pageInserted = 0;
    for (const item of items) {
      if (!passesFilters(item)) continue;
      if (exists.get(item.meta.prompt)) continue;

      const meta = item.meta;
      const { width, height } = parseSize(meta.Size);
      const name = 'CivitAI: ' + meta.prompt.slice(0, 50).replace(/\n/g, ' ').trim();

      insert.run({
        name,
        positive:   meta.prompt,
        negative:   meta.negativePrompt ?? null,
        base_model: meta.Model ?? item.baseModel ?? null,
        sampler:    meta.sampler ?? null,
        steps:      meta.steps ? parseInt(meta.steps) : null,
        cfg_scale:  meta.cfgScale ? parseFloat(meta.cfgScale) : null,
        seed:       meta.seed ? parseInt(meta.seed) : null,
        width, height,
        tags:     tag,
        category: 'civitai',
        notes:    `CivitAI image ID: ${item.id}${modelId ? ` | modelId: ${modelId}` : ''}`
      });
      pageInserted++;
    }

    totalInserted += pageInserted;
    console.log(`${items.length} fetched, ${pageInserted} inserted`);
    cursor = data.metadata?.nextCursor;
    if (!cursor) { console.log('  No more pages.'); break; }
  }

  return { totalFetched, totalInserted };
}

async function main() {
  const db = new Database(DB_PATH);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO prompts (name, positive, negative, base_model, sampler, steps, cfg_scale, seed, width, height, tags, category, notes)
    VALUES (@name, @positive, @negative, @base_model, @sampler, @steps, @cfg_scale, @seed, @width, @height, @tags, @category, @notes)
  `);
  const exists = db.prepare('SELECT 1 FROM prompts WHERE positive = ?');

  if (REQUIRE_KW.length) console.log(`Require any: ${REQUIRE_KW.join(', ')}`);
  if (EXCLUDE_KW.length) console.log(`Exclude any: ${EXCLUDE_KW.join(', ')}`);

  let grandTotal = { fetched: 0, inserted: 0 };

  if (MODEL_IDS?.length) {
    for (const modelId of MODEL_IDS) {
      const label = Object.entries(KNOWN_MODELS).find(([,v]) => v == modelId)?.[0] ?? `model-${modelId}`;
      console.log(`\n=== ${label} (id: ${modelId}) ===`);
      const { totalFetched, totalInserted } = await scrapeModel(db, insert, exists, modelId, label);
      grandTotal.fetched  += totalFetched;
      grandTotal.inserted += totalInserted;
    }
  } else {
    console.log('\n=== General scrape ===');
    const { totalFetched, totalInserted } = await scrapeModel(db, insert, exists, null, null);
    grandTotal.fetched  += totalFetched;
    grandTotal.inserted += totalInserted;
  }

  console.log(`\nDone. Fetched ${grandTotal.fetched}, inserted ${grandTotal.inserted} new prompts.`);
  db.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
