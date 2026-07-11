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
const BODYTYPE_NAMES = BODYTYPE_ARG ? BODYTYPE_ARG.split(',').map(s => s.trim()).filter(Boolean) : [];
const ROLE_ARG     = getArg('--role', null);
const ROLE_RANDOM  = ROLE_ARG === 'random';
const STYLE_ARG    = getArg('--style', null);
const STYLE_RANDOM = !STYLE_ARG;
const ACT_RANDOM   = hasFlag('--act_random');
const SCENE_RANDOM = hasFlag('--scene_random');
const THEME_RANDOM = hasFlag('--theme_random');
const TEMPERATURE          = parseFloat(getArg('--temperature', '1.0'));
const TOP_P                = getArg("--top_p", null);
const MIN_P                = getArg("--min_p", null);
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

function makePicker(arr) {
  let pool = [];
  return function() {
    if (!pool.length) pool = [...arr].sort(() => Math.random() - 0.5);
    return pool.pop();
  };
}

function resolveCategory(name) {
  const cat = CATEGORIES[name];
  if (!cat) { console.error(`Unknown category: "${name}". Run --list to see options.`); process.exit(1); }
  return cat;
}

// sceneCat  = location (beach, car, office…)
// actCat    = position/act (oral, doggy, missionary…)
// themeCat  = scenario/theme (bondage, pov, femdom…)
// Priority: scene → act → theme → role → DEFAULTS for settings
function padPool(pool, min = 8) {
  if (!pool || pool.length >= min) return pool || DEFAULTS.settings;
  return [...new Set([...pool, ...DEFAULTS.settings])];
}

function buildSkeleton(actCat, sceneCat, themeCat, effectiveRole = ROLE_ARG, effectiveStyle = STYLE_ARG) {
  const roleCatData  = effectiveRole  && effectiveRole  !== 'random' ? CATEGORIES[effectiveRole]  : null;
  const styleCatData = effectiveStyle ? CATEGORIES[effectiveStyle] : null;
  const raceCatData  = RACE_ARG     ? CATEGORIES[RACE_ARG]     : null;
  const bodyCatData  = BODYTYPE_NAMES.length ? CATEGORIES[BODYTYPE_NAMES[0]] : null;
  const S = {
    subjects: bodyCatData?.subjects || roleCatData?.subjects || actCat?.subjects || sceneCat?.subjects || DEFAULTS.subjects,
    settings: padPool(sceneCat?.settings || actCat?.settings || themeCat?.settings || roleCatData?.settings),
    lighting: styleCatData?.lighting || sceneCat?.lighting || actCat?.lighting || DEFAULTS.lighting,
    styles:   styleCatData?.styles   || sceneCat?.styles   || actCat?.styles   || DEFAULTS.styles,
    cameras:  DEFAULTS.cameras,
    clothing: roleCatData?.clothing || bodyCatData?.clothing || actCat?.clothing || sceneCat?.clothing || DEFAULTS.clothing,
  };
  if (!buildSkeleton._pickers || buildSkeleton._lastSubjects !== S.subjects || buildSkeleton._lastSettings !== S.settings || buildSkeleton._lastStyle !== effectiveStyle) {
    buildSkeleton._pickers = {
      subject:  makePicker(S.subjects),
      setting:  makePicker(S.settings),
      lighting: makePicker(S.lighting),
      style:    makePicker(S.styles),
      camera:   makePicker(S.cameras),
      clothing: makePicker(S.clothing),
    };
    buildSkeleton._lastSubjects = S.subjects;
    buildSkeleton._lastSettings = S.settings;
    buildSkeleton._lastStyle    = effectiveStyle;
  }
  const p = buildSkeleton._pickers;
  const skeleton = {
    subject:  SUBJECT_ARG || p.subject(),
    setting:  p.setting(),
    lighting: p.lighting(),
    style:    p.style(),
    camera:   p.camera(),
    clothing: p.clothing(),
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
  if (BODYTYPE_NAMES.length) skeleton.body_type = BODYTYPE_NAMES.map(n => BODYTYPE_LABELS[n] || n).join(', ');
  if (effectiveRole && effectiveRole !== 'random') {
    const roleCat = CATEGORIES[effectiveRole];
    skeleton.role = roleCat?.label?.split(' —')[0] || effectiveRole;
  }
  return skeleton;
}

const SYSTEM = `You are a ComfyUI image generation prompt engineer. You write detailed, vivid prompts for photorealistic NSFW/explicit image generation. CRITICAL: You MUST use the EXACT setting, subject, race, body_type, role, and theme from the skeleton — never substitute or omit them. Output ONLY the raw prompt text — no intro, no quotes, no explanation. 150-200 words. Include: subject description (incorporating race, body type, role/character, and theme if given), clothing/nudity state, setting/environment, lighting quality, mood/atmosphere, camera/lens details. Realistic photography ONLY — no anime, no illustration, no cartoon. GENDER RULE: the subject field defines all people in the scene and their gender. Men have exclusively male anatomy. Women have exclusively female anatomy. body_type descriptors apply only to women in the scene — never to men. Never mix or swap anatomy between genders.`;

async function generatePrompt(skeleton, actCat, sceneCat, themeCat, roleCat) {
  const skeletonStr = Object.entries(skeleton).map(([k,v]) => `${k}: ${v}`).join('\n');
  const emphasisParts = [];
  if (actCat?.emphasis)   emphasisParts.push(`Act emphasis: ${actCat.emphasis}`);
  if (sceneCat?.emphasis) emphasisParts.push(`Scene emphasis: ${sceneCat.emphasis}`);
  if (themeCat?.emphasis) emphasisParts.push(`Theme emphasis: ${themeCat.emphasis}`);
  if (roleCat?.emphasis)   emphasisParts.push(`Role emphasis: ${roleCat.emphasis}`);
  const styleCat2 = STYLE_ARG    ? CATEGORIES[STYLE_ARG]    : null;
  const raceCat2  = RACE_ARG     ? CATEGORIES[RACE_ARG]     : null;
  const bodyCat2  = BODYTYPE_NAMES.length ? CATEGORIES[BODYTYPE_NAMES[0]] : null;
  const bodyEmphases = BODYTYPE_NAMES.map(n => CATEGORIES[n]?.emphasis).filter(Boolean);
  if (styleCat2?.emphasis) emphasisParts.push(`Style emphasis: ${styleCat2.emphasis}`);
  if (raceCat2?.emphasis)  emphasisParts.push(`Race emphasis: ${raceCat2.emphasis}`);
  if (bodyEmphases.length) emphasisParts.push(`Body emphasis: ${bodyEmphases.join('; ')}`);
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
  if (MIN_P && parseFloat(MIN_P) > 0) reqBody.min_p = parseFloat(MIN_P);
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

  const ALL_ROLES  = ROLE_RANDOM  ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'role')  : null;
  const ALL_ACTS   = ACT_RANDOM   ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'act')   : null;
  const ALL_SCENES = SCENE_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'scene') : null;
  const ALL_THEMES = THEME_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'theme') : null;
  const ALL_STYLES = STYLE_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'style') : null;
  const roleCat = (ROLE_ARG && !ROLE_RANDOM) ? CATEGORIES[ROLE_ARG] : null;
  if (ROLE_ARG && !ROLE_RANDOM && !roleCat) { console.error(`Unknown role: "${ROLE_ARG}"`); process.exit(1); }

  const parts = [`model=${MODEL}`];
  if (actNames.length)   parts.push(`acts=${actNames.join(',')}`);   else if (ACT_RANDOM)   parts.push('act=random');
  if (sceneNames.length) parts.push(`scenes=${sceneNames.join(',')}`); else if (SCENE_RANDOM) parts.push('scene=random');
  if (themeNames.length) parts.push(`themes=${themeNames.join(',')}`); else if (THEME_RANDOM) parts.push('theme=random');
  if (RACE_ARG)          parts.push(`race=${RACE_ARG}`);
  if (BODYTYPE_ARG)      parts.push(`bodytype=${BODYTYPE_ARG}`);
  if (ROLE_ARG)          parts.push(ROLE_RANDOM ? 'role=random' : `role=${ROLE_ARG}`);
  parts.push(STYLE_ARG ? `style=${STYLE_ARG}` : 'style=random');
  if (SUBJECT_ARG)       parts.push(`subject=${SUBJECT_ARG}`);
  console.log(`Generating ${COUNT} prompts | ${parts.join(' | ')}`);

  const db = new Database(DB_PATH);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO prompts (name, positive, tags, category, notes)
    VALUES (@name, @positive, @tags, @category, @notes)
  `);
  const exists = db.prepare('SELECT 1 FROM prompts WHERE positive = ?');

  let inserted = 0, failed = 0;

  const ALLOW_CONFLICTS = hasFlag('--allow-conflicts');
  let rerollsThisSlot = 0;
  for (let i = 0; i < COUNT; i++) {
    const actName   = ALL_ACTS   ? ALL_ACTS[Math.floor(Math.random()   * ALL_ACTS.length)]   : (actNames.length   ? pick(actNames)   : null);
    const sceneName = ALL_SCENES ? ALL_SCENES[Math.floor(Math.random() * ALL_SCENES.length)] : (sceneNames.length ? pick(sceneNames) : null);
    const themeName = ALL_THEMES ? ALL_THEMES[Math.floor(Math.random() * ALL_THEMES.length)] : (themeNames.length ? pick(themeNames) : null);
    const actCat    = actName   ? CATEGORIES[actName]   : null;
    const sceneCat  = sceneName ? CATEGORIES[sceneName] : null;
    const themeCat  = themeName ? CATEGORIES[themeName] : null;
    const effectiveRole  = ROLE_RANDOM  ? ALL_ROLES[Math.floor(Math.random()  * ALL_ROLES.length)]  : ROLE_ARG;
    const effectiveStyle = STYLE_RANDOM ? ALL_STYLES[Math.floor(Math.random() * ALL_STYLES.length)] : STYLE_ARG;

    if (!ALLOW_CONFLICTS) {
      const dominantSettings = (sceneCat?.settings || actCat?.settings || themeCat?.settings);
      const roleCatForConflict = effectiveRole && effectiveRole !== 'random' ? CATEGORIES[effectiveRole] : null;
      if (dominantSettings && roleCatForConflict?.settings) {
        const overlap = dominantSettings.some(s => roleCatForConflict.settings.includes(s));
        if (!overlap) {
          if (!rerollsThisSlot) rerollsThisSlot = 0;
          rerollsThisSlot++;
          if (rerollsThisSlot <= 20) { i--; continue; }
          process.stdout.write('(no compatible role found, skipping) ');
          rerollsThisSlot = 0;
          failed++;
          continue;
        }
      }
      rerollsThisSlot = 0;
    }

    const skeleton  = buildSkeleton(actCat, sceneCat, themeCat, effectiveRole, effectiveStyle);
    if (themeName) skeleton.theme = themeCat?.label?.split(' —')[0] || themeName;

    const loopRoleCat  = effectiveRole  ? CATEGORIES[effectiveRole]  : null;
    const loopStyleCat = effectiveStyle ? CATEGORIES[effectiveStyle] : null;
    const catTag = [actName, sceneName, themeName].filter(Boolean).map(n => `[${n}]`).join('');
    const tags = [catTag, RACE_ARG ? `[${RACE_ARG}]` : '', BODYTYPE_ARG ? `[${BODYTYPE_ARG}]` : '', effectiveRole ? `[${effectiveRole}]` : '', effectiveStyle ? `[${effectiveStyle}]` : ''].filter(Boolean).join('');
    process.stdout.write(`  [${i+1}/${COUNT}]${tags ? ' ' + tags : ''} ${skeleton.subject} / ${skeleton.setting}... `);

    try {
      let prompt = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = await generatePrompt(skeleton, actCat, sceneCat, themeCat, loopRoleCat);
        if (!candidate || candidate.length < 40) continue;
        if ((actName || sceneName) && !promptMatchesSetting(candidate, skeleton.setting)) {
          process.stdout.write('(retry: setting mismatch) ');
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
      if (effectiveRole) tagParts.push(effectiveRole);
      if (effectiveStyle) tagParts.push(effectiveStyle);
      tagParts.push(skeleton.setting);
      insert.run({
        name,
        positive: prompt,
        tags: tagParts.join(','),
        category: [actName, sceneName, themeName].filter(Boolean).join('+') || (effectiveRole ?? 'general'),
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
