#!/usr/bin/env node
// LLM-based prompt generator → prompts.db

const Database = require('better-sqlite3');
const path = require('path');

const os = require('os');
const fs = require('fs');
const DATA_DIR = process.platform === 'win32' && process.env.APPDATA
  ? require('path').join(process.env.APPDATA, 'SpicyPrompter')
  : require('path').join(os.homedir(), '.spicyprompter');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = require('path').join(DATA_DIR, 'prompts.db');

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
const STYLE_ARG      = getArg('--style', null);
const STYLE_RANDOM   = !STYLE_ARG;
const HAIR_COLOR_ARG        = getArg('--hair_color', null);
const FACIAL_EXPRESSION_ARG = getArg('--facial_expression', null);
const EYE_COLOR_ARG         = getArg('--eye_color', null);
const SKIN_TONE_ARG         = getArg('--skin_tone', null);
const CAMERA_VIEW_ARG       = getArg('--camera_view', null);
const ACT_RANDOM   = hasFlag('--act_random');
const SCENE_RANDOM = hasFlag('--scene_random');
const THEME_RANDOM = hasFlag('--theme_random');
const TEMPERATURE          = parseFloat(getArg('--temperature', '1.2'));
const TOP_P                = getArg("--top_p", null);
const MIN_P                = getArg("--min_p", null);
const REPETITION_PENALTY   = parseFloat(getArg('--repetition_penalty', '1.0'));
const MAX_TOKENS           = parseInt(getArg('--max_tokens', '350'));
const PROMPT_WORDS         = parseInt(getArg('--prompt_words', '110'), 10);
const RAW_OUTPUT           = hasFlag('--raw_output');
const ALLOW_TOYS           = hasFlag('--allow_toys');
const DATASET_MODE         = hasFlag('--dataset');
const GENDER_ARG           = getArg('--gender', 'women');
const CLOTHING_ARG         = getArg('--clothing', null);
const AGE_ARG              = getArg('--age', null);
const HAIR_LENGTH_ARG      = getArg('--hair_length', null);
const HAIR_STYLE_ARG       = getArg('--hair_style', null);
const FACIAL_HAIR_ARG      = getArg('--facial_hair', null);
const CLEAN_BG             = hasFlag('--clean_bg');

const RACE_LABELS = {
  asian: 'Asian', ebony: 'Black', latina: 'Latina',
  arabic: 'Arabic', indian: 'Indian', east_asian: 'East Asian',
  eastern_european: 'Eastern European', italian: 'Italian',
  japanese: 'Japanese', korean: 'Korean', filipina: 'Filipina',
  brazilian: 'Brazilian', scandinavian: 'Scandinavian', persian: 'Persian',
  russian: 'Russian', biracial: 'Mixed/Biracial', french: 'French',
  armenian: 'Armenian',
  turkish: 'Turkish',
  native_american: 'Native American',
  pacific_islander: 'Pacific Islander',
  celtic: 'Celtic / Irish',
  moroccan: 'Moroccan',
  ethiopian: 'Ethiopian',
  caribbean: 'Caribbean',
  mexican: 'Mexican',
  colombian: 'Colombian',
  argentinian: 'Argentinian',
  puerto_rican: 'Puerto Rican',
};

const BODYTYPE_LABELS = {
  bbw: 'BBW', busty: 'busty', petite: 'petite', petite_teen: 'petite teen',
  milf: 'MILF', mature: 'mature', pregnant: 'pregnant', tattoos: 'tattooed',
  athletic: 'athletic', amazon: 'amazon', curvy: 'curvy', thick: 'thick',
  chubby: 'chubby', flat_chested: 'flat-chested', piercings: 'pierced',
  // male builds
  male_slim: 'slim, lean build', male_athletic: 'athletic, fit build',
  male_muscular: 'muscular, well-built', male_broad: 'broad-shouldered, stocky build',
  male_heavy: 'heavy-set build', male_tall: 'tall, slender build',
};

const DEFAULTS = {
  subjects: ['woman','woman in her 20s','woman in her 30s','two women','man and woman'],
  settings: ['bedroom','hotel room','beach','outdoor park','rooftop at night','forest clearing','bathroom','studio','living room sofa','balcony','swimming pool','changing room','urban alley'],
  lighting: ['natural window light','golden hour sunlight','soft overcast daylight','studio softbox lighting','candlelight','blue hour','neon signs at night'],
  styles:   ['candid photography','editorial photography','lifestyle photography','artistic nude','documentary style','professional photoshoot','voyeuristic candid','intimate photography'],
  cameras:  ['shot on DSLR, 85mm f/1.8','35mm film grain','RAW photo, Sony A7R IV','Canon 5D Mark IV, 50mm','Fujifilm X-T4, natural tones','Leica M, street documentary'],
  clothing: ['topless','fully nude','in lingerie','partially undressed','wearing only underwear','nude','in sheer fabric'],
};

const CLOTHING_LABELS = {
  nude:            'nude',
  casual_outfit:   'casual jeans and relaxed top, fully clothed',
  athletic_wear:   'fitted athletic sportswear, workout clothes',
  business_casual: 'business casual blazer and neat blouse, professional',
  summer_dress:    'light floral summer dress, fully clothed',
  formal_wear:     'formal evening gown, elegant dress',
  neutral_outfit:  'plain neutral t-shirt and jeans, simple everyday clothing, no patterns',
  male_casual:     'casual jeans and t-shirt, fully clothed',
  male_athletic:   'athletic t-shirt and shorts, sportswear',
  male_business:   'business casual dress shirt and slacks',
  male_smart:      'smart casual chinos and button-up shirt',
  male_formal:     'formal suit and tie, well-dressed',
  male_neutral:    'plain neutral t-shirt and jeans, simple everyday clothing, no patterns',
};

if (DATASET_MODE) {
  const AGE_SUBJECTS_F = {
    late_teens: ['young woman, 18 years old', 'young woman, 19 years old', 'young woman in her late teens'],
    '20s':      ['woman in her early 20s', 'woman in her mid-20s', 'woman in her late 20s'],
    '30s':      ['woman in her early 30s', 'woman in her mid-30s', 'woman in her late 30s'],
    '40s':      ['woman in her early 40s', 'woman in her mid-40s', 'woman in her late 40s'],
    '50s':      ['woman in her 50s', 'mature woman in her 50s', 'mature woman in her early 60s'],
  };
  const AGE_SUBJECTS_M = {
    late_teens: ['young man, 18 years old', 'young man, 19 years old', 'college-age young man'],
    '20s':      ['man in his early 20s', 'man in his mid-20s', 'man in his late 20s'],
    '30s':      ['man in his early 30s', 'man in his mid-30s', 'man in his late 30s'],
    '40s':      ['man in his early 40s', 'man in his mid-40s', 'man in his late 40s'],
    '50s':      ['man in his 50s', 'mature man in his 50s', 'distinguished man in his early 60s'],
  };
  const ageSubjectMap = GENDER_ARG === 'men' ? AGE_SUBJECTS_M : AGE_SUBJECTS_F;
  const datasetSubjects = (AGE_ARG && ageSubjectMap[AGE_ARG])
    ? ageSubjectMap[AGE_ARG]
    : GENDER_ARG === 'men'
      ? ['man', 'man in his 20s', 'man in his 30s', 'man in his 40s']
      : ['woman', 'woman in her 20s', 'woman in her 30s', 'young woman'];
  DEFAULTS.subjects = datasetSubjects;
  DEFAULTS.settings = CLEAN_BG
    ? ['studio with solid color backdrop', 'plain white studio background', 'seamless neutral gray backdrop', 'clean studio setup, minimal background']
    : ['studio with neutral backdrop', 'outdoor park, natural light', 'coffee shop interior', 'urban sidewalk', 'garden patio', 'library reading area', 'bright living room'];
  DEFAULTS.lighting = CLEAN_BG
    ? ['studio softbox lighting', 'ring light, even illumination', 'beauty light, front-facing', 'diffused studio strobe lighting', 'soft studio fill light']
    : ['soft natural window light', 'golden hour sunlight', 'diffused overcast daylight', 'studio softbox lighting', 'bright outdoor daylight'];
  DEFAULTS.styles   = ['portrait photography', 'lifestyle photography', 'editorial fashion photography', 'character reference photography'];
  DEFAULTS.cameras  = ['85mm portrait lens, f/2.0, shallow depth of field', '50mm lens, natural perspective', 'Canon 5D, portrait mode, sharp focus'];
  DEFAULTS.clothing = ['casual jeans and relaxed t-shirt, fully clothed', 'light summer dress, fully clothed', 'business casual blazer and blouse', 'athletic sportswear, fitted', 'cozy sweater and slacks, fully clothed'];
}

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
        solo_compatible: r.solo_compatible === 1,
        ff_only:         r.ff_only === 1,
        multi_required:  r.multi_required === 1,
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

const SCENE_SETTING_MAP = {
  pool:         'swimming pool',
  beach:        'beach',
  bedroom:      'hotel room',
  kitchen:      'kitchen',
  shower:       'bathroom',
  outdoor:      'outdoor park',
  gym:          'gym',
  office:       'office',
  car:          'car',
  dressing_room:'dressing room',
  dungeon:      'dungeon',
  nightclub:    'nightclub',
  stripclub:    'strip club stage',
  forest:       'forest clearing',
  rooftop:      'rooftop',
  library:      'library',
  dorm:         'dorm room',
  livingroom:   'living room sofa',
  massage:      'massage room',
  sauna:        'sauna',
  spa:          'spa',
  public:       'public street',
  barn:         'barn',
  airplane:     'airplane lavatory',
  limo:         'limousine backseat',
  yacht:        'yacht deck',
  cabin:        'cabin',
};

const SCENE_LIGHTING_MAP = {
  // outdoor
  pool:         ['golden hour sunlight','soft overcast daylight','blue hour'],
  beach:        ['golden hour sunlight','soft overcast daylight','blue hour'],
  outdoor:      ['golden hour sunlight','soft overcast daylight','blue hour'],
  forest:       ['soft overcast daylight','golden hour sunlight'],
  rooftop:      ['golden hour sunlight','blue hour','neon signs at night'],
  barn:         ['golden hour sunlight','soft overcast daylight','natural window light'],
  yacht:        ['golden hour sunlight','soft overcast daylight','blue hour'],
  // indoor warm
  cabin:        ['candlelight','natural window light'],
  bedroom:      ['candlelight','natural window light','studio softbox lighting'],
  livingroom:   ['candlelight','natural window light','studio softbox lighting'],
  massage:      ['candlelight','natural window light'],
  sauna:        ['candlelight','natural window light'],
  spa:          ['candlelight','natural window light','studio softbox lighting'],
  // indoor bright
  kitchen:      ['natural window light','studio softbox lighting'],
  shower:       ['natural window light','studio softbox lighting'],
  dorm:         ['natural window light','studio softbox lighting'],
  office:       ['natural window light','studio softbox lighting'],
  library:      ['natural window light','studio softbox lighting'],
  gym:          ['natural window light','studio softbox lighting'],
  dressing_room:['natural window light','studio softbox lighting'],
  // dark / neon
  dungeon:      ['candlelight'],
  nightclub:    ['neon signs at night'],
  stripclub:    ['neon signs at night','studio softbox lighting'],
  // mobile
  car:          ['golden hour sunlight','blue hour','natural window light'],
  limo:         ['blue hour','neon signs at night'],
  airplane:     ['natural window light','soft overcast daylight'],
  public:       ['golden hour sunlight','soft overcast daylight','blue hour','neon signs at night'],
};

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

const MALE_ACT_RE = /\bman\b|\bmen\b|\bhim\b|\bhis\b/i;

function isSoloFemale(subject) {
  const s = (subject || '').toLowerCase();
  return !MALE_ACT_RE.test(s) && !/two\s+\w+|three\s+\w+|\band\b/.test(s) && s.length > 0;
}

function hasMalePresent(subject) {
  return /\bman\b|\bmen\b|\bmale\b/i.test(subject || '');
}

function personCount(subject) {
  const s = (subject || '').toLowerCase();
  if (/\bthree\b|\bthreesome\b/.test(s)) return 3;
  if (/\btwo\b/.test(s) && /\band\b/.test(s)) return 3;
  if (/\btwo\b|\bcouple\b/.test(s)) return 2;
  if (/\band a\b|\band the\b|\band \w/.test(s)) return 2;
  if (/\bwomen\b|\bmen\b/.test(s)) return 2;
  return 1;
}

function getPersonLabels(subject) {
  const s = (subject || '').toLowerCase();
  if (s.includes('three women') || s.includes('three girls')) return ['the first woman', 'the second woman', 'the third woman'];
  if (s.includes('two women') || s.includes('two girls'))     return ['the first woman', 'the second woman'];
  if (/\bman\b/.test(s) && s.includes('woman'))               return ['the woman'];
  if (s.includes(' and '))                                     return ['person 1', 'person 2'];
  return ['the woman'];
}

function buildSkeleton(actCat, sceneCat, themeCat, effectiveRole = ROLE_ARG, effectiveStyle = STYLE_ARG) {
  const roleCatData  = effectiveRole  && effectiveRole  !== 'random' ? CATEGORIES[effectiveRole]  : null;
  const styleCatData = effectiveStyle ? CATEGORIES[effectiveStyle] : null;
  const raceCatData  = RACE_ARG     ? CATEGORIES[RACE_ARG]     : null;
  const bodyCatData  = BODYTYPE_NAMES.length ? CATEGORIES[BODYTYPE_NAMES[0]] : null;
  const S = {
    subjects: DATASET_MODE ? DEFAULTS.subjects : (bodyCatData?.subjects || roleCatData?.subjects || actCat?.subjects || sceneCat?.subjects || DEFAULTS.subjects),
    settings: padPool(sceneCat?.settings || actCat?.settings || themeCat?.settings || roleCatData?.settings),
    lighting: (DATASET_MODE && CLEAN_BG) ? DEFAULTS.lighting : (styleCatData?.lighting || sceneCat?.lighting || actCat?.lighting || DEFAULTS.lighting),
    styles:   DATASET_MODE ? DEFAULTS.styles : (styleCatData?.styles || sceneCat?.styles || actCat?.styles || DEFAULTS.styles),
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
  if (CLOTHING_ARG) skeleton.clothing = CLOTHING_LABELS[CLOTHING_ARG] || CLOTHING_ARG.replace(/_/g, ' ');
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
  if (BODYTYPE_NAMES.length) {
    const personLabels = getPersonLabels(skeleton.subject);
    if (BODYTYPE_NAMES.length > 1 && personLabels.length > 1) {
      skeleton.body_type = BODYTYPE_NAMES.slice(0, personLabels.length).map((n, i) =>
        `${personLabels[i]}: ${BODYTYPE_LABELS[n] || n}`
      ).join(', ');
    } else {
      skeleton.body_type = BODYTYPE_NAMES.map(n => BODYTYPE_LABELS[n] || n).join(', ');
    }
  }
  if (effectiveRole && effectiveRole !== 'random') {
    const roleCat = CATEGORIES[effectiveRole];
    skeleton.role = roleCat?.label?.split(' —')[0] || effectiveRole;
  }
  if (HAIR_COLOR_ARG) {
    skeleton.hair_color = HAIR_COLOR_ARG.replace(/_/g, ' ') + ' hair';
  }
  if (FACIAL_EXPRESSION_ARG) {
    skeleton.facial_expression = FACIAL_EXPRESSION_ARG.replace(/_/g, ' ');
  }
  if (EYE_COLOR_ARG) {
    skeleton.eye_color = EYE_COLOR_ARG.replace(/_/g, ' ') + ' eyes';
  }
  if (SKIN_TONE_ARG) {
    skeleton.skin_tone = SKIN_TONE_ARG.replace(/_/g, ' ') + ' skin';
  }
  if (CAMERA_VIEW_ARG) {
    skeleton.camera_angle = CAMERA_VIEW_ARG.replace(/_/g, ' ');
  }
  return skeleton;
}

const SYSTEM = `You are a ComfyUI image generation prompt engineer. You write detailed, vivid prompts for photorealistic NSFW/explicit image generation. CRITICAL: You MUST use the EXACT setting, subject, race, body_type, hair_color, facial_expression, role, camera_angle, and theme from the skeleton — never substitute or omit them. Output ONLY the raw prompt text — no intro, no quotes, no explanation. ${PROMPT_WORDS} words. Always end on a complete sentence. Include: subject description (incorporating race, body type, hair color, facial expression, role/character, and theme if given), clothing/nudity state, setting/environment, lighting quality, mood/atmosphere, camera/lens details. If camera_angle is given, compose the shot from that exact viewpoint. If facial_expression is given, the subject's face must show that exact expression throughout. Realistic photography ONLY — no anime, no illustration, no cartoon. ONE subject only — never include observers, bystanders, unseen people, or any secondary figures. Over-shoulder shots must show only the primary subject from behind with no other person implied or present. SUBJECT RULE (ABSOLUTE): The subject field is the complete and exclusive cast. Do not invent or add any person not listed in subject. If subject is "woman", there is exactly one woman and no one else — no men, no additional characters. If subject is "two women", only two women. ADAPT the act to fit the subject — never add people to make an act work. A solo-subject act becomes self-pleasure${ALLOW_TOYS ? ', or tasteful prop/toy use (realistic sizes and use only — no extreme or grotesque descriptions)' : ''}. CONFLICT RULE: When act and subject are incompatible (e.g. partnered act with solo subject), adapt the act to be solo-compatible. Prioritize: subject > act > scene > theme. ANATOMY RULES (ABSOLUTE, NO EXCEPTIONS): (1) Women have a vagina, no penis ever. Men have a penis, no vagina ever. No character may have genitalia of the opposite sex. (2) Body type descriptors apply only to female characters — never to men. (3) When scene contains women AND men, all sexual acts must be heterosexual male-female only — no male-male acts. (4) Never write futa, futanari, or gender-mixed anatomy. (5) ORAL SEX DIRECTION (ABSOLUTE): In heterosexual scenes, fellatio is ALWAYS performed BY the woman ON the man — the man is the receiver, never the performer. A man performing fellatio means he is performing on another man, which is forbidden in het scenes. The woman NEVER has a penis, shaft, member, or cock under any framing. If the act is oral in a het scene, the woman performs fellatio on the man. SKELETON ECHO RULE (ABSOLUTE): NEVER output skeleton fields as standalone sentences. Forbidden sentence patterns: "The race is ...", "The body type is ...", "The role is ...", "The theme is ...", "The act is ...", "The scene is ...". Weave these details into the prose description only — never list them as separate statements.`;

const SYSTEM_DATASET = `You are a photorealistic portrait prompt engineer for LoRA training datasets. Write detailed, realistic character portrait prompts. Output ONLY the raw prompt text — no intro, no quotes, no explanation. ${PROMPT_WORDS} words. Always end on a complete sentence. Include: subject appearance (race, body type, hair color, eye color, skin tone, facial expression), clothing/outfit description (follow the skeleton clothing field exactly — if nude, describe nude), setting/environment, lighting quality, mood, camera angle and composition. If camera_angle is given, compose the shot from that exact viewpoint. If facial_expression is given, the subject must show that expression. Realistic photography ONLY — no anime, no illustration, no cartoon. ONE subject only — never include observers, bystanders, unseen people, or any secondary figures. Over-shoulder shots must show only the primary subject from behind with no other person implied or present. SKELETON ECHO RULE: Never output skeleton fields as standalone sentences. Weave all details into flowing prose description only.`;

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
  if (styleCat2?.emphasis) emphasisParts.push(`Style emphasis: ${styleCat2.emphasis}`);
  if (raceCat2?.emphasis)  emphasisParts.push(`Race emphasis: ${raceCat2.emphasis}`);
  if (BODYTYPE_NAMES.length) {
    const personLabels = getPersonLabels(skeleton.subject);
    if (BODYTYPE_NAMES.length > 1 && personLabels.length > 1) {
      const perPerson = BODYTYPE_NAMES.slice(0, personLabels.length).map((n, i) => {
        const em = CATEGORIES[n]?.emphasis;
        return em ? `${personLabels[i]}: ${em}` : null;
      }).filter(Boolean);
      if (perPerson.length) emphasisParts.push(`Body emphasis: ${perPerson.join(' | ')}`);
    } else {
      const bodyEmphases = BODYTYPE_NAMES.map(n => CATEGORIES[n]?.emphasis).filter(Boolean);
      if (bodyEmphases.length) emphasisParts.push(`Body emphasis: ${bodyEmphases.join('; ')}`);
    }
  }
  // Bust conflict: petite/slim/flat + busty — model tends to suppress large chest
  const hasBusty     = BODYTYPE_NAMES.includes('busty');
  const hasSmallFrame = BODYTYPE_NAMES.some(n => ['petite','petite_teen','slim','flat_chested'].includes(n));
  if (hasBusty && hasSmallFrame) {
    emphasisParts.push('BUST CONTRAST (ABSOLUTE): Subject has a small, slim frame with disproportionately large natural breasts — this contrast is intentional and MUST be described explicitly. Do NOT reduce breast size to match the frame. Write large breasts on a petite body.');
  }
  const emphasisLine = emphasisParts.length ? '\n' + emphasisParts.join('\n') : '';
  const subjectLower = (skeleton.subject || '').toLowerCase();
  const hasMaleSubject = /\bman\b|\bmen\b/.test(subjectLower);
  const hasMultipleFemales = /two women|three women|\bwomen\b/.test(subjectLower);
  let castOverride = '';
  if (!hasMaleSubject && emphasisParts.length) {
    if (hasMultipleFemales) {
      castOverride = '\nCAST OVERRIDE (ABSOLUTE): Scene is all-female — no male characters exist. Adapt all acts to be performed between the women only.';
    } else {
      castOverride = '\nCAST OVERRIDE (ABSOLUTE): Subject is a solo woman — no male characters exist. Adapt any partnered act to solo self-pleasure'+(ALLOW_TOYS?' or toy use':'')+'.';
    }
  }
  // Cumshot/finish rule: when act involves external finish and subject has a woman
  const FINISH_ACTS = /facial|cum_play|bukakke|creampie|breeding/i;
  const hasWomanSubject = /\bwoman\b|\bwomen\b|\bgirl\b/i.test(skeleton.subject || '');
  const isFinishAct = actCat && (FINISH_ACTS.test(actCat.name || '') || FINISH_ACTS.test(actCat.emphasis || ''));
  const cumRule = (isFinishAct && hasWomanSubject) ? '\nCUMSHOT RULE (ABSOLUTE): The finish is always received by the woman. Never on the man.' : '';
  const soloNoCum = (!hasMaleSubject && isSoloFemale(skeleton.subject)) ? '\nSOLO FEMALE RULE (ABSOLUTE): No males, no penis, no cum, no semen, no ejaculate, no white fluid on skin. Female squirting is clear fluid only — never say ejaculation, cum, or semen. Never use the word \'orgasmic\' — instead say: ecstatic, overwhelmed by pleasure, lost in sensation. Skin moisture is sweat or water only — never describe skin as oily, oil-coated, or glazed. JOI scenes show only the woman teasing — no completion, no finish, no implied viewer orgasm. Include the phrase \'clean skin\' somewhere in the prompt to reinforce the image model.' : '';
  const cameraAngleRule     = CAMERA_VIEW_ARG       ? `\nCAMERA ANGLE (ABSOLUTE): Shoot this scene from ${CAMERA_VIEW_ARG.replace(/_/g, ' ')} — this is the primary viewpoint. Describe the composition from this exact angle.` : '';
  const hairColorRule       = HAIR_COLOR_ARG        ? `\nHAIR COLOR (ABSOLUTE): The subject has ${HAIR_COLOR_ARG.replace(/_/g, ' ')} hair. Describe it explicitly — do not substitute or omit.` : '';
  const expressionRule      = FACIAL_EXPRESSION_ARG ? `\nFACIAL EXPRESSION (ABSOLUTE): The subject's face shows ${FACIAL_EXPRESSION_ARG.replace(/_/g, ' ')} — describe this expression explicitly in the prompt.` : '';
  const eyeColorRule        = EYE_COLOR_ARG         ? `\nEYE COLOR (ABSOLUTE): The subject has ${EYE_COLOR_ARG.replace(/_/g, ' ')} eyes. Mention eye color explicitly — do not substitute or omit.` : '';
  const skinToneRule        = SKIN_TONE_ARG         ? `\nSKIN TONE (ABSOLUTE): The subject has ${SKIN_TONE_ARG.replace(/_/g, ' ')} skin. Describe this skin tone explicitly — overrides any race-implied skin tone.` : '';
  const ageRule             = AGE_ARG               ? `\nAGE (ABSOLUTE): Subject is in their ${AGE_ARG.replace(/_/g, ' ')} — reflect this clearly in appearance and features.` : '';
  const hairLengthRule      = HAIR_LENGTH_ARG        ? `\nHAIR LENGTH (ABSOLUTE): Subject has ${HAIR_LENGTH_ARG.replace(/_/g, ' ')} hair — describe the length explicitly.` : '';
  const hairStyleRule       = HAIR_STYLE_ARG         ? `\nHAIR STYLE (ABSOLUTE): Subject has ${HAIR_STYLE_ARG.replace(/_/g, ' ')} hair — describe the texture and style explicitly.` : '';
  const facialHairRule      = FACIAL_HAIR_ARG        ? `\nFACIAL HAIR (ABSOLUTE): Subject has ${FACIAL_HAIR_ARG.replace(/_/g, ' ')} — describe it explicitly in the prompt.` : '';
  const userMsg = DATASET_MODE
    ? `Generate a detailed SFW photorealistic character portrait prompt for LoRA training using this skeleton:
${skeletonStr}${emphasisLine}${cameraAngleRule}${hairColorRule}${expressionRule}${eyeColorRule}${skinToneRule}${ageRule}${hairLengthRule}${hairStyleRule}${facialHairRule}

IMPORTANT: Use the EXACT subject, race, body_type, clothing, hair_color, eye_color, skin_tone, facial_expression, and camera_angle. Expand into a rich, detailed portrait description.`
    : `Generate a detailed photorealistic NSFW image generation prompt using this scene skeleton:
${skeletonStr}${emphasisLine}${castOverride}${cumRule}${soloNoCum}${cameraAngleRule}${hairColorRule}${expressionRule}${eyeColorRule}${skinToneRule}${ageRule}${hairLengthRule}${hairStyleRule}${facialHairRule}

IMPORTANT: Use the EXACT setting, subject, race, body_type, role, theme, hair_color, eye_color, skin_tone, facial_expression, and camera_angle. Expand into a rich, explicit prompt.`;

  const baseInstruction = '\n\nSTRICTLY FORBIDDEN: Do not include any explanation, reasoning, commentary, or meta-text. Do not pad with filler sentences like \"The X is Y.\" or \"The moment is captured.\" -- every sentence must describe a specific visual detail. Output ONLY the image prompt text. No sentences about incompatibility, adaptations, or scene logic.';
  const activeSystem = DATASET_MODE ? SYSTEM_DATASET : SYSTEM;
  const systemContent = RAW_OUTPUT
    ? activeSystem + baseInstruction + ' Begin directly with the image description, no preamble.'
    : activeSystem + baseInstruction;
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
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return stripMetaCommentary(cleaned);
}

function stripMetaCommentary(text) {
  return text
    .replace(/[^.!?]*\bincompatible\b[^.!?]*[.!?]\s*/gi, '')
    .replace(/[^.!?]*\bcannot be performed\b[^.!?]*[.!?]\s*/gi, '')
    .replace(/[^.!?]*\badapting the act\b[^.!?]*[.!?]\s*/gi, '')
    .replace(/Thus,?\s+[^.!?]*adapting[^.!?]*[.!?]\s*/gi, '')
    .replace(/However,?\s+the act[^.!?]*[.!?]\s*/gi, '')
    .replace(/However,?\s+[^.!?]*incompatib[^.!?]*[.!?]\s*/gi, '')
    .replace(/Note(?:\s+that)?:?[^.!?]*[.!?]\s*/gi, '')
    .replace(/Please note[^.!?]*[.!?]\s*/gi, '')
    .replace(/The (?:race|body type|role|theme|act|scene) is \S[^.!?]*[.!?]\s*/gi, '')
    .replace(/The \w+ (?:is|are|was) \w+\.\s*/gi, '')
    .replace(/\s+The \w[^.!?]*$/, '')
    .trim();
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
  const ALL_ACTS_FULL = ACT_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'act') : null;
  const ALL_ACTS = (() => {
    if (!ALL_ACTS_FULL || !SUBJECT_ARG) return ALL_ACTS_FULL;
    return ALL_ACTS_FULL.filter(k => {
      const cat = CATEGORIES[k];
      if (isSoloFemale(SUBJECT_ARG) && !cat.solo_compatible) return false;
      if (cat.ff_only && hasMalePresent(SUBJECT_ARG)) return false;
      if (cat.multi_required && personCount(SUBJECT_ARG) < 3) return false;
      return true;
    });
  })();
  const ALL_SCENES = SCENE_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'scene') : null;
  const ALL_THEMES_FULL = THEME_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'theme') : null;
  const ALL_THEMES = (() => {
    if (!ALL_THEMES_FULL || !SUBJECT_ARG) return ALL_THEMES_FULL;
    return ALL_THEMES_FULL.filter(k => {
      const cat = CATEGORIES[k];
      if (isSoloFemale(SUBJECT_ARG) && !cat.solo_compatible) return false;
      if (cat.multi_required && personCount(SUBJECT_ARG) < 3) return false;
      return true;
    });
  })();
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
  if (HAIR_COLOR_ARG)        parts.push(`hair_color=${HAIR_COLOR_ARG}`);
  if (FACIAL_EXPRESSION_ARG) parts.push(`facial_expression=${FACIAL_EXPRESSION_ARG}`);
  if (EYE_COLOR_ARG)         parts.push(`eye_color=${EYE_COLOR_ARG}`);
  if (SKIN_TONE_ARG)         parts.push(`skin_tone=${SKIN_TONE_ARG}`);
  if (CAMERA_VIEW_ARG)       parts.push(`camera_view=${CAMERA_VIEW_ARG}`);
  console.log(`Generating ${COUNT} prompts | ${parts.join(' | ')}`);

  const db = new Database(DB_PATH);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO prompts (name, positive, tags, category, notes)
    VALUES (@name, @positive, @tags, @category, @notes)
  `);
  const exists = db.prepare('SELECT 1 FROM prompts WHERE positive = ?');

  let inserted = 0, failed = 0;

  for (let i = 0; i < COUNT; i++) {
    const actName   = ALL_ACTS   ? ALL_ACTS[Math.floor(Math.random()   * ALL_ACTS.length)]   : (actNames.length   ? pick(actNames)   : null);
    const sceneName = ALL_SCENES ? ALL_SCENES[Math.floor(Math.random() * ALL_SCENES.length)] : (sceneNames.length ? pick(sceneNames) : null);
    const themeName = ALL_THEMES ? ALL_THEMES[Math.floor(Math.random() * ALL_THEMES.length)] : (themeNames.length ? pick(themeNames) : null);
    const actCat    = actName   ? CATEGORIES[actName]   : null;
    const sceneCat  = sceneName ? CATEGORIES[sceneName] : null;
    const themeCat  = themeName ? CATEGORIES[themeName] : null;
    const effectiveRole  = ROLE_RANDOM  ? ALL_ROLES[Math.floor(Math.random()  * ALL_ROLES.length)]  : ROLE_ARG;
    const effectiveStyle = (DATASET_MODE || !STYLE_RANDOM) ? STYLE_ARG : ALL_STYLES[Math.floor(Math.random() * ALL_STYLES.length)];

    const skeleton  = buildSkeleton(actCat, sceneCat, themeCat, effectiveRole, effectiveStyle);
    if (sceneName && SCENE_SETTING_MAP[sceneName]) skeleton.setting = SCENE_SETTING_MAP[sceneName];
    if (sceneName && SCENE_LIGHTING_MAP[sceneName]) {
      const opts = SCENE_LIGHTING_MAP[sceneName];
      skeleton.lighting = opts[Math.floor(Math.random() * opts.length)];
    }
    if (themeName) skeleton.theme = themeCat?.label?.split(' —')[0] || themeName;

    // Re-roll act if incompatible with subject (solo, ff_only, multi_required)
    let resolvedActName = actName;
    let resolvedActCat  = actCat;
    if (ALL_ACTS_FULL && resolvedActName) {
      const subj = skeleton.subject;
      const actIncompat =
        (isSoloFemale(subj) && !resolvedActCat?.solo_compatible) ||
        (resolvedActCat?.ff_only && hasMalePresent(subj)) ||
        (resolvedActCat?.multi_required && personCount(subj) < 3);
      if (actIncompat) {
        const compatible = ALL_ACTS_FULL.filter(k => {
          const cat = CATEGORIES[k];
          if (isSoloFemale(subj) && !cat.solo_compatible) return false;
          if (cat.ff_only && hasMalePresent(subj)) return false;
          if (cat.multi_required && personCount(subj) < 3) return false;
          return true;
        });
        if (compatible.length) {
          resolvedActName = compatible[Math.floor(Math.random() * compatible.length)];
          resolvedActCat  = CATEGORIES[resolvedActName];
        }
      }
    }
    // Re-roll theme if solo subject but theme is not solo compatible
    let resolvedThemeName = themeName;
    if (ALL_THEMES_FULL && resolvedThemeName) {
      const subj = skeleton.subject;
      const themeIncompat =
        (isSoloFemale(subj) && !CATEGORIES[resolvedThemeName]?.solo_compatible) ||
        (CATEGORIES[resolvedThemeName]?.multi_required && personCount(subj) < 3);
      if (themeIncompat) {
        const compatThemes = ALL_THEMES_FULL.filter(k => {
          const cat = CATEGORIES[k];
          if (isSoloFemale(subj) && !cat.solo_compatible) return false;
          if (cat.multi_required && personCount(subj) < 3) return false;
          return true;
        });
        if (compatThemes.length) resolvedThemeName = compatThemes[Math.floor(Math.random() * compatThemes.length)];
      }
    }
    const resolvedThemeCat = resolvedThemeName ? CATEGORIES[resolvedThemeName] : null;
    if (resolvedThemeName && resolvedThemeName !== themeName) skeleton.theme = resolvedThemeCat?.label?.split(' —')[0] || resolvedThemeName;

    const loopRoleCat  = effectiveRole  ? CATEGORIES[effectiveRole]  : null;
    const loopStyleCat = effectiveStyle ? CATEGORIES[effectiveStyle] : null;
    const catTag = [resolvedActName, sceneName, resolvedThemeName].filter(Boolean).map(n => `[${n}]`).join('');
    const tags = [catTag, RACE_ARG ? `[${RACE_ARG}]` : '', BODYTYPE_ARG ? `[${BODYTYPE_ARG}]` : '', effectiveRole ? `[${effectiveRole}]` : '', effectiveStyle ? `[${effectiveStyle}]` : ''].filter(Boolean).join('');
    process.stdout.write(`  [${i+1}/${COUNT}]${tags ? ' ' + tags : ''} ${skeleton.subject} / ${skeleton.setting}... `);

    try {
      let prompt = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = await generatePrompt(skeleton, resolvedActCat, sceneCat, resolvedThemeCat, loopRoleCat);
        if (!candidate || candidate.length < 40) continue;
        prompt = candidate;
        break;
      }
      if (!prompt) { console.log('skip'); failed++; continue; }
      if (exists.get(prompt)) { console.log('duplicate'); continue; }
      const name = prompt.slice(0, 60).replace(/\n/g, ' ').trim();
      const tagParts = [];
      if (resolvedActName) tagParts.push(resolvedActName);
      if (sceneName)    tagParts.push(sceneName);
      if (resolvedThemeName) tagParts.push(resolvedThemeName);
      if (RACE_ARG)     tagParts.push(RACE_ARG);
      if (BODYTYPE_ARG) tagParts.push(BODYTYPE_ARG);
      if (DATASET_MODE) tagParts.push('dataset');
      if (DATASET_MODE && CAMERA_VIEW_ARG) tagParts.push(CAMERA_VIEW_ARG);
      if (effectiveRole) tagParts.push(effectiveRole);
      if (effectiveStyle) tagParts.push(effectiveStyle);
      tagParts.push(skeleton.setting);
      const insertInfo = insert.run({
        name,
        positive: prompt,
        tags: tagParts.join(','),
        category: [actName, sceneName, resolvedThemeName].filter(Boolean).join('+') || (effectiveRole ?? 'general'),
        notes: `model:${MODEL} skeleton:${JSON.stringify(skeleton)}`,
      });
      inserted++;
      console.log('ok');
      if (insertInfo.changes) process.stdout.write(`PROMPT_ID:${insertInfo.lastInsertRowid}\n`);
    } catch (e) {
      console.log(`error: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Inserted ${inserted}, failed ${failed}.`);
  db.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
