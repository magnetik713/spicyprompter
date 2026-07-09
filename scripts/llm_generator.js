#!/usr/bin/env node
// LLM-based prompt generator → prompts.db

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'prompts.db');

const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i+1] : def; };
const hasFlag = flag => args.includes(flag);

const LITELLM_URL = getArg('--url', 'http://localhost:11434/v1');
const LITELLM_KEY = getArg('--key', 'ollama');

const COUNT        = parseInt(getArg('--count', '20'));
const MODEL        = getArg('--model', 'qwen3.6:35b-a3b');
const CAT_ARG      = getArg('--category', null);
const SUBJECT_ARG  = getArg('--subject', null);
const RACE_ARG     = getArg('--race', null);
const BODYTYPE_ARG = getArg('--bodytype', null);
const ROLE_ARG     = getArg('--role', null);
const STYLE_ARG    = getArg('--style', null);
const TEMPERATURE          = parseFloat(getArg('--temperature', '1.0'));
const TOP_P                = getArg('--top_p', null);
const REPETITION_PENALTY   = parseFloat(getArg('--repetition_penalty', '1.1'));
const MAX_TOKENS           = parseInt(getArg('--max_tokens', '300'));
const RAW_OUTPUT           = hasFlag('--raw_output');

const RACE_LABELS = {
  asian: 'Asian', ebony: 'Black', latina: 'Latina',
  arabic: 'Arabic', indian: 'Indian', east_asian: 'East Asian',
  eastern_european: 'Eastern European', italian: 'Italian',
  japanese: 'Japanese', korean: 'Korean', filipina: 'Filipina',
  brazilian: 'Brazilian', scandinavian: 'Scandinavian', persian: 'Persian',
  russian: 'Russian', biracial: 'Mixed/Biracial', french: 'French',
  armenian: 'Armenian',
};

const BODYTYPE_LABELS = {
  bbw: 'BBW', busty: 'busty', petite: 'petite', petite_teen: 'petite teen',
  milf: 'MILF', mature: 'mature', pregnant: 'pregnant', trans: 'trans', tattoos: 'tattooed',
  athletic: 'athletic', amazon: 'amazon', curvy: 'curvy', thick: 'thick',
  chubby: 'chubby', flat_chested: 'flat-chested',
};

const DEFAULTS = {
  subjects: ['woman','woman in her 20s','woman in her 30s','two women','man and woman'],
  settings: ['bedroom','hotel room','beach','outdoor park','rooftop at night','forest clearing','bathroom','studio','living room sofa','balcony','swimming pool','changing room','urban alley'],
  lighting: ['natural window light','golden hour sunlight','soft overcast daylight','studio softbox lighting','candlelight','blue hour','neon signs at night'],
  styles:   ['candid photography','editorial photography','lifestyle photography','artistic nude','documentary style','professional photoshoot','voyeuristic candid','intimate photography'],
  cameras:  ['shot on DSLR, 85mm f/1.8','35mm film grain','RAW photo, Sony A7R IV','Canon 5D Mark IV, 50mm','Fujifilm X-T4, natural tones','Leica M, street documentary'],
  clothing: ['topless','fully nude','in lingerie','partially undressed','wearing only underwear','nude','in sheer fabric'],
};

function loadCategories() {
  try {
    const tmpDb = new Database(DB_PATH);
    const rows = tmpDb.prepare('SELECT * FROM llm_categories').all();
    tmpDb.close();
    if (rows.length === 0) return {};
    const cats = {};
    for (const r of rows) {
      cats[r.name] = {
        label:    r.label,
        type:     r.type || 'scene',
        emphasis: r.emphasis,
        subjects: r.subjects ? r.subjects.split('|') : null,
        settings: r.settings ? r.settings.split('|') : null,
        clothing: r.clothing ? r.clothing.split('|') : null,
        styles:   r.styles   ? r.styles.split('|')   : null,
        lighting: r.lighting ? r.lighting.split('|') : null,
      };
    }
    return cats;
  } catch(e) { return {}; }
}
const CATEGORIES = loadCategories();

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function resolveCategory(name) {
  const cat = CATEGORIES[name];
  if (!cat) { console.error(`Unknown category: "${name}". Run --list to see options.`); process.exit(1); }
  return cat;
}

// sceneCat  = location (beach, car, office…)
// actCat    = position/act (oral, doggy, missionary…)
// themeCat  = scenario/theme (bondage, pov, femdom…)
// Priority: scene → act → theme → role → DEFAULTS for settings
function buildSkeleton(actCat, sceneCat, themeCat) {
  const roleCatData  = ROLE_ARG     ? CATEGORIES[ROLE_ARG]     : null;
  const styleCatData = STYLE_ARG    ? CATEGORIES[STYLE_ARG]    : null;
  const raceCatData  = RACE_ARG     ? CATEGORIES[RACE_ARG]     : null;
  const bodyCatData  = BODYTYPE_ARG ? CATEGORIES[BODYTYPE_ARG] : null;
  const S = {
    subjects: bodyCatData?.subjects || actCat?.subjects   || sceneCat?.subjects  || DEFAULTS.subjects,
    settings: sceneCat?.settings || actCat?.settings    || themeCat?.settings || roleCatData?.settings || DEFAULTS.settings,
    lighting: styleCatData?.lighting || sceneCat?.lighting || actCat?.lighting || DEFAULTS.lighting,
    styles:   styleCatData?.styles   || sceneCat?.styles   || actCat?.styles   || DEFAULTS.styles,
    cameras:  DEFAULTS.cameras,
    clothing: roleCatData?.clothing || bodyCatData?.clothing || actCat?.clothing || sceneCat?.clothing || DEFAULTS.clothing,
  };
  const skeleton = {
    subject:  SUBJECT_ARG || pick(S.subjects),
    setting:  pick(S.settings),
    lighting: pick(S.lighting),
    style:    pick(S.styles),
    camera:   pick(S.cameras),
    clothing: pick(S.clothing),
  };
  if (RACE_ARG) {
    const raceLabel = RACE_LABELS[RACE_ARG] || RACE_ARG;
    const subj = skeleton.subject.toLowerCase();
    const hasWoman = subj.includes('woman') || subj.includes('women');
    if (hasWoman) {
      const plural = subj.includes('two women') || subj.includes('three women') || (subj.includes('women') && !subj.includes('woman '));
      skeleton.race = (plural ? 'The women are ' : 'The woman is ') + raceLabel;
    } else {
      skeleton.race = raceLabel;
    }
  }
  if (BODYTYPE_ARG) skeleton.body_type = BODYTYPE_LABELS[BODYTYPE_ARG] || BODYTYPE_ARG;
  if (ROLE_ARG) {
    const roleCat = CATEGORIES[ROLE_ARG];
    skeleton.role = roleCat?.label?.split(' —')[0] || ROLE_ARG;
  }
  return skeleton;
}

const SYSTEM = `You are a ComfyUI image generation prompt engineer. You write detailed, vivid prompts for photorealistic NSFW/explicit image generation. CRITICAL: You MUST use the EXACT setting, subject, race, body_type, role, and theme from the skeleton — never substitute or omit them. Output ONLY the raw prompt text — no intro, no quotes, no explanation. 80-140 words. Include: subject description (incorporating race, body type, role/character, and theme if given), clothing/nudity state, setting/environment, lighting quality, mood/atmosphere, camera/lens details. Realistic photography ONLY — no anime, no illustration, no cartoon.`;

async function generatePrompt(skeleton, actCat, sceneCat, themeCat, roleCat) {
  const skeletonStr = Object.entries(skeleton).map(([k,v]) => `${k}: ${v}`).join('\n');
  const emphasisParts = [];
  if (actCat?.emphasis)   emphasisParts.push(`Act emphasis: ${actCat.emphasis}`);
  if (sceneCat?.emphasis) emphasisParts.push(`Scene emphasis: ${sceneCat.emphasis}`);
  if (themeCat?.emphasis) emphasisParts.push(`Theme emphasis: ${themeCat.emphasis}`);
  if (roleCat?.emphasis)   emphasisParts.push(`Role emphasis: ${roleCat.emphasis}`);
  const styleCat2 = STYLE_ARG    ? CATEGORIES[STYLE_ARG]    : null;
  const raceCat2  = RACE_ARG     ? CATEGORIES[RACE_ARG]     : null;
  const bodyCat2  = BODYTYPE_ARG ? CATEGORIES[BODYTYPE_ARG] : null;
  if (styleCat2?.emphasis) emphasisParts.push(`Style emphasis: ${styleCat2.emphasis}`);
  if (raceCat2?.emphasis)  emphasisParts.push(`Race emphasis: ${raceCat2.emphasis}`);
  if (bodyCat2?.emphasis)  emphasisParts.push(`Body emphasis: ${bodyCat2.emphasis}`);
  const emphasisLine = emphasisParts.length ? '\n' + emphasisParts.join('\n') : '';
  const userMsg = `Generate a detailed photorealistic NSFW image generation prompt using this scene skeleton:\n${skeletonStr}${emphasisLine}\n\nIMPORTANT: Use the EXACT setting, subject, race, body_type, role, and theme. Expand into a rich, explicit prompt.`;

  const systemContent = RAW_OUTPUT
    ? SYSTEM + '\n\nSTRICTLY FORBIDDEN: any preamble, quotes, markdown, or explanation. Begin directly with the image description.'
    : SYSTEM;
    const reqBody = {
    model: MODEL,
    messages: [{ role: 'system', content: systemContent }, { role: 'user', content: userMsg }],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  };
  if (TOP_P && parseFloat(TOP_P) > 0) reqBody.top_p = parseFloat(TOP_P);
  if (REPETITION_PENALTY > 1.0) reqBody.repetition_penalty = REPETITION_PENALTY;
  const r = await fetch(`${LITELLM_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LITELLM_KEY}` },
    body: JSON.stringify(reqBody)
  });
  if (!r.ok) throw new Error(`LiteLLM error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function settingKeywords(setting) {
  return setting.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
}
function promptMatchesSetting(prompt, setting) {
  return settingKeywords(setting).some(w => prompt.toLowerCase().includes(w));
}

async function main() {
  if (hasFlag('--list')) {
    const byType = {};
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      (byType[cat.type] = byType[cat.type] || []).push([key, cat]);
    }
    for (const [type, cats] of Object.entries(byType)) {
      console.log(`\n  [${type}]`);
      cats.forEach(([k, c]) => console.log(`    ${k.padEnd(18)} ${c.label}`));
    }
    return;
  }

  const catNames = CAT_ARG ? CAT_ARG.split(',').map(s => s.trim()) : null;
  if (catNames) catNames.forEach(n => resolveCategory(n));

  const actNames   = catNames ? catNames.filter(n => CATEGORIES[n]?.type === 'act')   : [];
  const sceneNames = catNames ? catNames.filter(n => CATEGORIES[n]?.type === 'scene') : [];
  const themeNames = catNames ? catNames.filter(n => CATEGORIES[n]?.type === 'theme') : [];

  const roleCat = ROLE_ARG ? CATEGORIES[ROLE_ARG] : null;
  if (ROLE_ARG && !roleCat) { console.error(`Unknown role: "${ROLE_ARG}"`); process.exit(1); }

  const parts = [`model=${MODEL}`];
  if (actNames.length)   parts.push(`acts=${actNames.join(',')}`);
  if (sceneNames.length) parts.push(`scenes=${sceneNames.join(',')}`);
  if (themeNames.length) parts.push(`themes=${themeNames.join(',')}`);
  if (RACE_ARG)          parts.push(`race=${RACE_ARG}`);
  if (BODYTYPE_ARG)      parts.push(`bodytype=${BODYTYPE_ARG}`);
  if (ROLE_ARG)          parts.push(`role=${ROLE_ARG}`);
  if (STYLE_ARG)         parts.push(`style=${STYLE_ARG}`);
  if (SUBJECT_ARG)       parts.push(`subject=${SUBJECT_ARG}`);
  console.log(`Generating ${COUNT} prompts | ${parts.join(' | ')}`);

  const db = new Database(DB_PATH);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO prompts (name, positive, tags, category, notes)
    VALUES (@name, @positive, @tags, @category, @notes)
  `);
  const exists = db.prepare('SELECT 1 FROM prompts WHERE positive = ?');

  let inserted = 0, failed = 0;

  for (let i = 0; i < COUNT; i++) {
    const actName   = actNames.length   ? pick(actNames)   : null;
    const sceneName = sceneNames.length ? pick(sceneNames) : null;
    const themeName = themeNames.length ? pick(themeNames) : null;
    const actCat    = actName   ? CATEGORIES[actName]   : null;
    const sceneCat  = sceneName ? CATEGORIES[sceneName] : null;
    const themeCat  = themeName ? CATEGORIES[themeName] : null;
    const skeleton  = buildSkeleton(actCat, sceneCat, themeCat);
    if (themeName) skeleton.theme = themeCat?.label?.split(' —')[0] || themeName;

    const catTag = [actName, sceneName, themeName].filter(Boolean).map(n => `[${n}]`).join('');
    const tags = [catTag, RACE_ARG ? `[${RACE_ARG}]` : '', BODYTYPE_ARG ? `[${BODYTYPE_ARG}]` : '', ROLE_ARG ? `[${ROLE_ARG}]` : ''].filter(Boolean).join('');
    process.stdout.write(`  [${i+1}/${COUNT}]${tags ? ' ' + tags : ''} ${skeleton.subject} / ${skeleton.setting}... `);

    try {
      let prompt = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = await generatePrompt(skeleton, actCat, sceneCat, themeCat, roleCat);
        if (!candidate || candidate.length < 40) continue;
        if ((actName || sceneName) && !promptMatchesSetting(candidate, skeleton.setting)) {
          process.stdout.write('(retry) ');
          continue;
        }
        prompt = candidate;
        break;
      }
      if (!prompt) { console.log('skip'); failed++; continue; }
      if (exists.get(prompt)) { console.log('duplicate'); continue; }
      const name = prompt.slice(0, 60).replace(/\n/g, ' ').trim();
      const tagParts = [];
      if (actName)      tagParts.push(actName);
      if (sceneName)    tagParts.push(sceneName);
      if (themeName)    tagParts.push(themeName);
      if (RACE_ARG)     tagParts.push(RACE_ARG);
      if (BODYTYPE_ARG) tagParts.push(BODYTYPE_ARG);
      if (ROLE_ARG)     tagParts.push(ROLE_ARG);
      if (STYLE_ARG)    tagParts.push(STYLE_ARG);
      tagParts.push(skeleton.setting);
      insert.run({
        name,
        positive: prompt,
        tags: tagParts.join(','),
        category: [actName, sceneName, themeName].filter(Boolean).join('+') || (ROLE_ARG ?? 'general'),
        notes: `model:${MODEL} skeleton:${JSON.stringify(skeleton)}`,
      });
      inserted++;
      console.log('ok');
    } catch (e) {
      console.log(`error: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Inserted ${inserted}, failed ${failed}.`);
  db.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
