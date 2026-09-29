#!/usr/bin/env node
// LLM-based prompt generator → prompts.db

const Database = require('better-sqlite3');
const path = require('path');

const os = require('os');
const fs = require('fs');
// Mirrors db.js so NODE_ENV=test isolates this script too. Without it a test
// run writes straight into the real prompt library.
const DATA_DIR = process.env.NODE_ENV === 'test'
  ? require('path').join(__dirname, '..')
  : (process.platform === 'win32' && process.env.APPDATA
      ? require('path').join(process.env.APPDATA, 'SpicyPrompter')
      : require('path').join(os.homedir(), '.spicyprompter'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = require('path').join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'test.db' : 'prompts.db');

const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i+1] : def; };
const hasFlag = flag => args.includes(flag);

const LITELLM_URL = getArg('--url', 'http://localhost:11434/v1');
const LITELLM_KEY = getArg('--key', 'ollama');

const COUNT        = parseInt(getArg('--count', '20'));
const MODEL        = getArg('--model', 'qwen3.6:35b-a3b');
const CAT_ARG      = getArg('--category', null);
const SUBJECT_ARG  = getArg('--subject', null);
// Reassigned per prompt when --race_random / --bodytype_random are set, so a
// run varies instead of drawing once. Mirrors how --act_random works.
let RACE_ARG     = getArg('--race', null);
let BODYTYPE_ARG = getArg('--bodytype', null);
let BODYTYPE_NAMES = BODYTYPE_ARG ? BODYTYPE_ARG.split(',').map(s => s.trim()).filter(Boolean) : [];
const MODIFIER_BODYTYPES = new Set(['busty','flat_chested','piercings','pregnant','tattoos']);
// Appearance attributes are hardcoded radio lists in the view, not category
// rows, so their pools live here. Drawn per prompt, like --act_random.
const HAIR_COLOR_POOL = ['black', 'brunette', 'blonde', 'red', 'auburn', 'platinum_blonde', 'silver', 'pink', 'blue'];
const HAIR_LENGTH_POOL = ['short', 'medium_length', 'long', 'very_long'];
const HAIR_STYLE_POOL = ['straight', 'wavy', 'curly', 'braids'];
const FACIAL_EXPRESSION_POOL = ['moaning', 'ahegao', 'eyes_closed', 'biting_lip', 'eye_contact', 'looking_up', 'smirking', 'shy', 'pleading', 'blissful'];
const EYE_COLOR_POOL = ['brown', 'blue', 'green', 'hazel', 'gray', 'amber', 'dark'];
const HAIR_COLOR_RANDOM = hasFlag('--hair_color_random');
const HAIR_LENGTH_RANDOM = hasFlag('--hair_length_random');
const HAIR_STYLE_RANDOM = hasFlag('--hair_style_random');
const FACIAL_EXPRESSION_RANDOM = hasFlag('--facial_expression_random');
const EYE_COLOR_RANDOM = hasFlag('--eye_color_random');
const RACE_RANDOM     = hasFlag('--race_random');
const BODYTYPE_RANDOM = hasFlag('--bodytype_random');
const ROLE_ARG     = getArg('--role', null);
const ROLE_RANDOM  = ROLE_ARG === 'random';
const STYLE_ARG      = getArg('--style', null);
const STYLE_RANDOM   = !STYLE_ARG;
const LIGHTING_ARG   = getArg('--lighting', null);
const LIGHTING_RANDOM = !LIGHTING_ARG;
const COMPAT_ARG     = getArg('--compat', 'illustrious');
const QUALITY_TAGS   = COMPAT_ARG === 'pony'
  ? 'score_9, score_8_up, score_7_up, score_6_up, source_anime, rating:explicit'
  : COMPAT_ARG === 'noobai'
  ? 'masterpiece, best quality, newest, rating:explicit'
  : 'masterpiece, best quality, newest, absurdres, rating:explicit';
let HAIR_COLOR_ARG        = getArg('--hair_color', null);
let FACIAL_EXPRESSION_ARG = getArg('--facial_expression', null);
let EYE_COLOR_ARG         = getArg('--eye_color', null);
const SKIN_TONE_ARG         = getArg('--skin_tone', null);
const CAMERA_VIEW_ARG       = getArg('--camera_view', null);
const MODE_ARG               = getArg('--mode', 'realistic');
const HAND_ACTION_ARG       = getArg('--hand_action', null);
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
const INTERRACIAL          = hasFlag('--interracial');
let NO_THINK               = hasFlag('--no_think');
let LAST_SKIP_REASON       = '';
const DATASET_MODE         = hasFlag('--dataset');
const GENDER_ARG           = getArg('--gender', 'women');
const CLOTHING_ARG         = getArg('--clothing', null);
const AGE_ARG              = getArg('--age', null);
let HAIR_LENGTH_ARG      = getArg('--hair_length', null);
let HAIR_STYLE_ARG       = getArg('--hair_style', null);
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

// ebony is the generic Black race; omitting it made "Ebony + Interracial"
// pick Ethiopian or Caribbean as the contrast - two Black subjects.
const INTERRACIAL_DARK  = ['ebony','ethiopian','caribbean'];
const INTERRACIAL_LIGHT = ['scandinavian','eastern_european','french','celtic','russian'];
const INTERRACIAL_MID   = ['latina','east_asian','indian','arabic','brazilian','persian'];

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
        // Without this the mode filters below see undefined and fall through to
        // their realistic-only clause: every anime style leaked into realistic
        // runs, and anime mode got no styles or lighting at all.
        mode:     r.mode || 'all',
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

// A category belongs in this run if it is mode-agnostic or matches the
// requested mode. Every random selector uses this — anything that skips it
// puts anime categories in realistic prompts and vice versa.
function modeOk(cat) { return cat && (cat.mode === 'all' || cat.mode === MODE_ARG); }

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

// SCENE_LIGHTING_MAP only fires when a scene CATEGORY was chosen. Settings that
// come from a category's own list or from padPool()'s defaults need the same
// constraint, derived from the setting text itself. Ordered — first match wins,
// so "rooftop at night" is caught by the night rule before the outdoor one.
// Returns null when nothing matches, which leaves the draw untouched.
const SETTING_LIGHTING_RULES = [
  [/\bat night\b|nightclub|strip club|urban alley|limousine|\blimo\b/i,
    ['neon signs at night', 'blue hour']],
  [/dungeon/i,
    ['candlelight']],
  [/sauna|\bspa\b|massage/i,
    ['candlelight', 'natural window light']],
  [/bathroom|shower|changing room|dressing room|locker/i,
    ['natural window light', 'studio softbox lighting']],
  [/beach|forest|\bpark\b|yacht|barn|garden|\bfield\b|balcony|rooftop|pool|street|outdoor/i,
    ['golden hour sunlight', 'soft overcast daylight', 'blue hour']],
  [/bedroom|hotel|motel|dorm|cabin|living room|apartment|\bhouse\b/i,
    ['candlelight', 'natural window light', 'studio softbox lighting']],
  [/office|library|boardroom|conference|\bdesk\b|classroom|kitchen|\bgym\b|studio|\bcar\b|airplane/i,
    ['natural window light', 'studio softbox lighting']],
];

function lightingForSetting(setting) {
  const s = setting || '';
  for (const rule of SETTING_LIGHTING_RULES) if (rule[0].test(s)) return rule[1];
  return null;
}

// What each lighting category implies about the physical light source, and the
// phrase that describes it. 'any' is a look rather than a source (backlight,
// low key) and suits any setting.
const LIGHT_CAT_CLASS = {
  golden_hour: 'day',    harsh_sun: 'day',     overcast: 'day',
  moonlight: 'night',    blue_hour: 'night',
  neon_light: 'urban_night', neon_glow: 'urban_night',
  candlelight: 'indoor', firelight: 'indoor',  warm_indoor: 'indoor',
  natural_window: 'indoor', studio_flash: 'indoor', ring_light: 'indoor', spotlight: 'indoor',
  phone_flash: 'any',    backlit: 'any',       low_key: 'any',
  dramatic_shadows: 'any', magic_glow: 'any',  sakura_light: 'any',
};

const LIGHT_CAT_PHRASE = {
  golden_hour: 'golden hour sunlight',      harsh_sun: 'harsh direct sunlight',
  overcast: 'soft overcast daylight',       moonlight: 'moonlight',
  blue_hour: 'blue hour',                   neon_light: 'neon signs at night',
  neon_glow: 'neon signs at night',         candlelight: 'candlelight',
  firelight: 'firelight',                   warm_indoor: 'warm tungsten indoor lighting',
  natural_window: 'natural window light',   studio_flash: 'studio flash lighting',
  ring_light: 'ring light illumination',    spotlight: 'single spotlight',
  phone_flash: 'harsh on-camera phone flash', backlit: 'strong backlight',
  low_key: 'low key lighting',              dramatic_shadows: 'high-contrast dramatic shadows',
  magic_glow: 'magical luminescence',       sakura_light: 'cherry blossom ambient light',
};

// Which light-source classes a setting can physically support.
function settingLightClasses(setting) {
  const s = setting || '';
  // Neon belongs to built-up places. A beach or forest at night has
  // moonlight and blue hour, never signage. A dungeon is lit indoors.
  if (/\bat night\b|nightclub|strip club|urban alley|limousine|\blimo\b/i.test(s)) return ['urban_night', 'night', 'any'];
  if (/street|rooftop|balcony|\bcity\b/i.test(s)) return ['day', 'night', 'urban_night', 'any'];
  if (/beach|forest|\bpark\b|garden|\bfield\b|yacht|barn|pool|outdoor/i.test(s)) return ['day', 'night', 'any'];
  return ['indoor', 'any'];
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
const HAND_ACTIONS = [
  'gripping the bedsheets tightly',
  'fingers tangled in partner\'s hair, pulling firmly',
  'one hand pressed flat against the wall for balance',
  'hands gripping partner\'s hips firmly',
  'fingers curled around the headboard',
  'one hand bracing against the mattress',
  'running fingers slowly through her own hair',
  'nails lightly dragging down partner\'s back',
  'hands cupped tenderly around partner\'s face',
  'gripping partner\'s thighs firmly',
  'one hand pressed to her own chest',
  'fingers wrapped around partner\'s wrist',
  'hands clasped above her head against the pillow',
  'both hands gripping her buttocks',
  'hands gripping her breasts',
  'one hand touching her own neck and collarbone',
  'hands gripping the edge of the surface for leverage',
];
const HAND_ACTION_MAP = {
  hair_grab:   "fingers tangled in partner's hair, pulling firmly",
  hip_grip:    "hands gripping partner's hips firmly",
  wrist_grip:  "fingers wrapped around partner's wrist",
  face_cup:    "hands cupped tenderly around partner's face",
  thigh_grip:  "gripping partner's thighs firmly",
  breast_grip: "hands gripping her breasts",
  butt_grab:   "both hands gripping her buttocks",
  sheet_grip:  "gripping the bedsheets tightly",
  wall_brace:  "one hand pressed flat against the wall for balance",
  self_touch:  "one hand pressed to her own chest",
  headboard:   "fingers curled around the headboard",
};
function padPool(pool, min = 8) {
  if (!pool || pool.length >= min) return pool || DEFAULTS.settings;
  return [...new Set([...pool, ...DEFAULTS.settings])];
}

const MALE_ACT_RE = /\bman\b|\bmen\b|\bhim\b|\bhis\b/i;
const BED_ACTION_RE  = /bedsheet|pillow|headboard|mattress/i;
const BED_SETTING_RE = /bed|bedroom|hotel|motel|dorm|futon|apartment|bunk/i;  // not couch/sofa: no headboard or bedsheets there

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

function maleCount(subject) {
  const s = (subject || '').toLowerCase();
  if (/\bthree men\b/.test(s)) return 3;
  if (/\btwo men\b/.test(s)) return 2;
  if (/\bmen\b/.test(s)) return 2;
  if (/\bman\b/.test(s)) return 1;
  return 0;
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
    // ct_* keep their full label. Built-ins use the curated short label, which
    // is not always the category label (ebony reads as "Black"). A user-added
    // race has neither, so fall back to its own label before the bare slug -
    // otherwise the prompt says "The woman is zz_sami".
    const customRaceLabel = raceCatData && raceCatData.label ? raceCatData.label.split(' —')[0].trim() : '';
    const raceLabel = (RACE_ARG && RACE_ARG.startsWith('ct_') && raceCatData)
      ? raceCatData.label
      : (RACE_LABELS[RACE_ARG] || customRaceLabel || RACE_ARG);
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
  if (HAND_ACTION_ARG) {
    if (HAND_ACTION_ARG === 'random') {
      // A random draw must never hand a solo subject a partnered gesture. The
      // model obeys the CONFLICT RULE and "adapts" it, producing nonsense like
      // fingers wrapped around her own wrist. An explicit pick is left alone —
      // that one is a deliberate choice.
      let pool = HAND_ACTIONS;
      if (isSoloFemale(skeleton.subject)) pool = pool.filter(a => !/\bpartner\b/i.test(a));
      // Bed furniture only exists in some settings. Offering "gripping the
      // bedsheets" for a forest clearing puts a bed in the woods, and the
      // SYSTEM prompt mandates the hand action verbatim, so it cannot be
      // corrected downstream.
      if (!BED_SETTING_RE.test(skeleton.setting || '')) pool = pool.filter(a => !BED_ACTION_RE.test(a));
      if (!pool.length) pool = HAND_ACTIONS;
      skeleton.hand_action = pool[Math.floor(Math.random() * pool.length)];
    } else {
      skeleton.hand_action = HAND_ACTION_MAP[HAND_ACTION_ARG] || null;
    }
    if (!skeleton.hand_action) delete skeleton.hand_action;
  }
  return skeleton;
}

const SYSTEM = `You are a ComfyUI image generation prompt engineer. You write detailed, vivid prompts for photorealistic NSFW/explicit image generation. CRITICAL: You MUST use the EXACT setting, subject, race, body_type, hair_color, facial_expression, role, camera_angle, hand_action, and theme from the skeleton — never substitute or omit them. Output ONLY the raw prompt text — no intro, no quotes, no explanation. ${PROMPT_WORDS} words. Always end on a complete sentence. Include: subject description (incorporating race, body type, hair color, facial expression, role/character, and theme if given), clothing/nudity state, setting/environment, lighting quality, mood/atmosphere, camera/lens details. If camera_angle is given, compose the shot from that exact viewpoint. If hand_action is given, one or more subjects must have their hands doing exactly that — weave it naturally into the scene. If facial_expression is given, the subject's face must show that exact expression throughout. Realistic photography ONLY — no anime, no illustration, no cartoon. ONE subject only — never include observers, bystanders, unseen people, or any secondary figures. camera_angle=back_angle means: camera positioned behind the subject at upper-back/shoulder height — show their back, shoulder blades, and hair, with their face turned slightly toward camera or in profile. Write as rear three-quarter view or back angle — NEVER write over-the-shoulder, never imply a second person. SUBJECT RULE (ABSOLUTE): The subject field is the complete and exclusive cast. Do not invent or add any person not listed in subject. If subject is "woman", there is exactly one woman and no one else — no men, no additional characters. If subject is "two women", only two women. ADAPT the act to fit the subject — never add people to make an act work. A solo-subject act becomes self-pleasure${ALLOW_TOYS ? ', or tasteful prop/toy use (realistic sizes and use only — no extreme or grotesque descriptions)' : ''}. CONFLICT RULE: When act and subject are incompatible (e.g. partnered act with solo subject), adapt the act to be solo-compatible. Prioritize: subject > act > scene > theme. LOCATION RULE (ABSOLUTE): The setting field is the ONLY location. If clothing, act, or any other field names or implies a different place, keep the garment or state and DISCARD its location — never place the subject in two places in one scene. CAST PRESENCE (ABSOLUTE): Every person listed in the subject MUST appear physically in the scene — described by position, body, and role. If subject is "a woman and a man", BOTH must be explicitly present and active. The man cannot be implied, off-screen, or absent. A partnered act requires both partners visibly described. ANATOMY RULES (ABSOLUTE, NO EXCEPTIONS): (1) Women have a vagina, no penis ever. Men have a penis, no vagina ever. No character may have genitalia of the opposite sex. (2) Body type descriptors apply only to female characters — never to men. (3) When scene contains women AND men, all sexual acts must be heterosexual male-female only — no male-male acts. (4) Never write futa, futanari, or gender-mixed anatomy. (5) TITFUCK / PAIZURI (ABSOLUTE): The man's PENIS goes between the woman's breasts — she presses them together around his shaft. FORBIDDEN: man's head between breasts, man's face in cleavage, man buried in cleavage, any body part other than his penis between her breasts. His penis is sandwiched between her breasts from below — she looks down at him, he looks up at her. The woman is the performer; the man is the receiver of the act. (6) ORAL SEX DIRECTION (ABSOLUTE): Oral sex directed AT a man = fellatio — always. Oral sex directed AT a woman = cunnilingus — always, regardless of who performs it. Never write a man receiving cunnilingus or a woman receiving fellatio. The woman NEVER has a penis, shaft, member, or cock under any framing. If act is generic "oral" with a man and woman present, DEFAULT to fellatio (woman performing on man) — do NOT default to cunnilingus. Only write cunnilingus when the subject is two women or no man is present. SKELETON ECHO RULE (ABSOLUTE): NEVER output skeleton fields as standalone sentences. Forbidden sentence patterns: "The race is ...", "The body type is ...", "The role is ...", "The theme is ...", "The act is ...", "The scene is ...". Weave these details into the prose description only — never list them as separate statements.`;

const SYSTEM_ANIME = `You are a booru-tag prompt engineer for anime image generation models (Pony Diffusion, NoobAI, Illustrious). You write ONLY comma-separated booru-style tags — never prose, never sentences. Output ONLY the raw tag list. No intro, no quotes, no explanation. Tags must be explicit and graphic for the requested act. Start every output with: ${QUALITY_TAGS}. Then character count (1girl, 2girls, 1boy 1girl, etc). Then character features, then act/scene tags, then style tags. Every tag is lowercase. Use underscores for multi-word tags (e.g. long_hair, spread_legs, cum_on_face). Be direct and explicit about anatomy and acts — this is for adult content generation. Never write a sentence. Never write a description. Tags only. FORBIDDEN tags — never include any of these: camera brands (canon, nikon, sony, leica, fuji, hasselblad), lens specs (50mm, 85mm, 35mm, 24mm), photography terms (depth_of_field, bokeh, f/1.8, f/2.8, dslr, mirrorless, shot_on, raw_photo, candid_photography, candid, documentary, lifestyle_photography, street_photography, intimate_photography, shallow_depth_of_field, editorial, editorial_photography, softbox, softbox_lighting, studio_lighting, studio_softbox, studio_flash, ring_light, lifestyle, realistic_anatomy, detailed_skin_texture, realistic_proportions, detailed_anatomy, photo_realistic, hyperrealistic). These are PHOTOGRAPHY terms and have no place in anime tags. For lighting and atmosphere use ONLY anime-appropriate terms like: warm_lighting, moonlight, candlelight, neon_lights, dramatic_shadows, soft_light, golden_light, dappled_sunlight, firelight, dim_lighting, backlight, rim_light, natural_light. TAG FORMAT: use_underscores_for_multi_word_tags (e.g. long_hair, spread_legs, large_breasts). Single-word tags have no underscore. Spaces between tags use commas only. GENDER RULE (ABSOLUTE): When subject contains both female AND male characters, ALL sexual acts must be heterosexual male-female. A woman and a man = 1boy 1girl — write only heterosexual pairings. Two women and a man = 1boy 2girls — man interacts with women heterosexually. A woman and two men = 2boys 1girl — men interact with woman heterosexually. NEVER write male-on-male acts when a female is present in the subject.`;

const SYSTEM_DATASET = `You are a photorealistic portrait prompt engineer for LoRA training datasets. Write detailed, realistic character portrait prompts. Output ONLY the raw prompt text — no intro, no quotes, no explanation. ${PROMPT_WORDS} words. Always end on a complete sentence. Include: subject appearance (race, body type, hair color, eye color, skin tone, facial expression), clothing/outfit description (follow the skeleton clothing field exactly — if nude, describe nude), setting/environment, lighting quality, mood, camera angle and composition. If camera_angle is given, compose the shot from that exact viewpoint. If facial_expression is given, the subject must show that expression. Realistic photography ONLY — no anime, no illustration, no cartoon. ONE subject only — never include observers, bystanders, unseen people, or any secondary figures. camera_angle=back_angle means: camera positioned behind the subject at upper-back/shoulder height — show their back, shoulder blades, and hair, with their face turned slightly toward camera or in profile. Write as rear three-quarter view or back angle — NEVER write over-the-shoulder, never imply a second person. SKELETON ECHO RULE: Never output skeleton fields as standalone sentences. Weave all details into flowing prose description only.`;

async function generatePrompt(skeleton, actCat, sceneCat, themeCat, roleCat, lightingCat = null) {
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
  if (lightingCat?.emphasis) emphasisParts.push(`Lighting emphasis: ${lightingCat.emphasis}`);
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
  const hasFemaleSubject = /\bwoman\b|\bwomen\b|\bgirl\b/i.test(subjectLower);
  const isMaleOnly = hasMaleSubject && !hasFemaleSubject;
  const hasMultipleFemales = /two women|three women|\bwomen\b/.test(subjectLower);
  let castOverride = '';
  if (isMaleOnly) {
    castOverride = '\nCAST OVERRIDE (ABSOLUTE): Scene is all-male — no female characters exist. All acts are performed between the men only. Fingering, rimming, handjob, oral, and all other acts are male-on-male.';
  } else   if (!hasMaleSubject && emphasisParts.length) {
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
  const soloNoCum = (!hasMaleSubject && isSoloFemale(skeleton.subject)) ? '\nSOLO FEMALE RULE (ABSOLUTE): No males, no penis, no cum, no semen, no ejaculate, no white fluid on skin. Female squirting is clear fluid only — never say ejaculation, cum, or semen. Never use the word \'orgasmic\' — instead say: ecstatic, overwhelmed by pleasure, lost in sensation. Skin moisture is sweat or water only — never describe skin as oily, oil-coated, or glazed. Do NOT use \'glistening\', \'glistens\', \'wet\', \'slick\', \'sheen\', \'shiny\' or \'dripping\' for skin unless the scene contains real water (pool, shower, rain, ocean, bath) or she is visibly sweating from exertion — and when you do, name that source in the same sentence so it reads as water or sweat, never as fluid on her. Otherwise describe skin as matte, dry, soft or clean. JOI scenes show only the woman teasing — no completion, no finish, no implied viewer orgasm. Include the phrase \'clean skin\' somewhere in the prompt to reinforce the image model.\nSOLO FRAMING (ABSOLUTE): She is the ONLY person in the image. The prompt text MUST say so explicitly \u2014 say it as natural prose inside a sentence, for example \'she is the only person in the frame\', \'no one else is present\', \'the room is empty apart from her\', \'she is entirely by herself\'. Vary this wording between prompts \u2014 do not open every prompt the same way. This statement describes WHO IS PRESENT, never her posture: it must not override the pose the act calls for, so if she is on all fours or kneeling do not also write that she stands. Never stack it as an adjective before the noun: write \'a woman kneels alone in the room\', never \'a completely alone woman\'. This is for the image model, which never sees these instructions, so the words must appear in the output itself. Never imply a second person: no photographer, no observer, no other hands, arms, shadows or reflections of anyone else. If the style is candid, amateur, voyeur or hidden-camera, the camera is unmanned \u2014 mounted, propped, on a timer or held by her \u2014 never operated by another person in the scene.' : '';
  let interracialRule = '';
  if (INTERRACIAL) {
    const isAfricanRace = RACE_ARG && INTERRACIAL_DARK.includes(RACE_ARG);
    const contrastPool = isAfricanRace ? INTERRACIAL_LIGHT : INTERRACIAL_DARK;
    const race2 = contrastPool[Math.floor(Math.random() * contrastPool.length)];
    const label1 = RACE_ARG ? (RACE_LABELS[RACE_ARG] || RACE_ARG) : 'Caucasian';
    const label2 = RACE_LABELS[race2] || race2;
    interracialRule = `
INTERRACIAL CAST (ABSOLUTE): The subjects have contrasting racial backgrounds — ${label1} and ${label2}. Describe each person's race, skin tone, and physical features explicitly. The racial contrast is visually prominent.`;
  }
  const isSoloF = skeleton.subject ? isSoloFemale(skeleton.subject) : false;
  const isMulti = skeleton.subject ? personCount(skeleton.subject) > 1 : false;
  const povSelfie = (CAMERA_VIEW_ARG === 'pov' && isSoloF)
    ? ' Solo female selfie: she holds the camera toward herself — she is the sole subject, completely alone. CRITICAL: do NOT write the word "pov" anywhere in the output — image models associate that term with a male viewer. Instead describe this as a selfie, self-shot, self-portrait, or front-camera photo. Output MUST include "solo", "alone", and "1girl". No male viewer, no male hands, no male body parts, no implied male presence anywhere in frame.'
    : (CAMERA_VIEW_ARG === 'pov' && isMulti)
    ? ' Group POV/selfie mix: one participant holds the camera toward the group. Blends first-person POV with a selfie angle — camera-holder perspective implied while all subjects visible. Intimate close-range framing.'
    : '';
  const cameraAngleRule     = CAMERA_VIEW_ARG       ? `\nCAMERA ANGLE (ABSOLUTE): Shoot this scene from ${CAMERA_VIEW_ARG.replace(/_/g, ' ')}${povSelfie} — this is the primary viewpoint. Describe the composition from this exact angle.` : '';
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
    : MODE_ARG === 'anime'
    ? `Generate an anime-style NSFW image generation prompt as a TAG LIST using this scene skeleton:
${skeletonStr}${emphasisLine}${castOverride}${soloNoCum}${cameraAngleRule}${hairColorRule}${expressionRule}${eyeColorRule}${skinToneRule}${ageRule}${hairLengthRule}${hairStyleRule}

CRITICAL OUTPUT FORMAT: Write ONLY comma-separated booru-style tags. No sentences. No prose. No punctuation other than commas.
CHARACTER COUNT RULE (ABSOLUTE): Translate the subject field into count tags using ONLY these exact mappings — "woman"/"girl" = 1girl | "man"/"boy" = 1boy | "two women"/"two girls" = 2girls | "two men"/"two boys" = 2boys | "man and woman" or "woman and man" = 1boy 1girl | "two women and a man" or "two girls and a boy" = 1boy 2girls | "a woman and two men" or "two men and a woman" = 2boys 1girl | "three women" = 3girls | "three men" = 3boys. FORBIDDEN: never write 1boy 1boy (→ 2boys), never write 1girl 1girl (→ 2girls), never invent characters not in subject. Place count tag ONCE at the very start, never repeated anywhere.
Start with quality tags: ${QUALITY_TAGS}
Then: character count tag (1girl / 2girls / 1boy 1girl / etc)
Then: character type, features, hair, eyes, expression, body
Then: clothing or lack thereof (be explicit)
Then: act/scene/setting tags
Then: anime art style tags (e.g. cel_shading, flat_color, anime_style, dark_fantasy_anime) and mood/atmosphere using ONLY anime-appropriate lighting terms (moonlight, candlelight, neon_lights, dramatic_shadows — NEVER softbox, studio_lighting, bokeh, or any photography terms)
End with: explicit content tags describing the act graphically

Example format: ${QUALITY_TAGS}, 1girl, elf, long silver hair, green eyes, ahegao, large breasts, naked, spread legs, missionary, creampie, bedroom, moonlight, cel shading, anime style

Use the EXACT subject, character_type, role, act, scene, style from the skeleton. Be explicit and graphic with the act tags.`
    : `Generate a detailed photorealistic NSFW image generation prompt using this scene skeleton:
${skeletonStr}${emphasisLine}${castOverride}${cumRule}${soloNoCum}${interracialRule}${cameraAngleRule}${hairColorRule}${expressionRule}${eyeColorRule}${skinToneRule}${ageRule}${hairLengthRule}${hairStyleRule}${facialHairRule}

IMPORTANT: Use the EXACT setting, subject, race, body_type, role, theme, hair_color, eye_color, skin_tone, facial_expression, and camera_angle. Expand into a rich, explicit prompt.`;

  const baseInstruction = '\n\nSTRICTLY FORBIDDEN: Do not include any explanation, reasoning, commentary, or meta-text. Do not pad with filler sentences like \"The X is Y.\" or \"The moment is captured.\" -- every sentence must describe a specific visual detail. Output ONLY the image prompt text. No sentences about incompatibility, adaptations, or scene logic.';
  const activeSystem = DATASET_MODE ? SYSTEM_DATASET : (MODE_ARG === 'anime' ? SYSTEM_ANIME : SYSTEM);
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
  if (NO_THINK) reqBody.reasoning_effort = 'none';
  const send = async (body) => {
    const r = await fetch(`${LITELLM_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LITELLM_KEY}` },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`LiteLLM error ${r.status}: ${await r.text()}`);
    return r.json();
  };

  let data = await send(reqBody);
  let msg = data.choices?.[0]?.message ?? {};
  const reasoningOf = (m) => m.reasoning || m.reasoning_content || '';

  // Reasoning models can burn the entire token budget thinking, which leaves
  // content empty — the thinking comes back in a separate `reasoning` field.
  // Retry once with thinking off, then stay off for the rest of the run.
  if (!NO_THINK && !(msg.content || '').trim() && reasoningOf(msg)) {
    try {
      const retry = await send({ ...reqBody, reasoning_effort: 'none' });
      const retryMsg = retry.choices?.[0]?.message ?? {};
      if ((retryMsg.content || '').trim()) {
        NO_THINK = true;
        data = retry;
        msg = retryMsg;
        process.stdout.write('\n    [info] model used its whole token budget thinking - thinking disabled for the rest of this run\n');
      }
    } catch (e) {
      LAST_SKIP_REASON = `retry without thinking failed: ${e.message}`;
    }
  }

  const raw = msg.content ?? '';
  if (!raw.trim()) {
    const rz = reasoningOf(msg);
    LAST_SKIP_REASON = rz
      ? `model returned ${rz.length} chars of thinking and no answer (finish_reason=${data.choices?.[0]?.finish_reason}) - raise --max_tokens or pass --no_think`
      : `model returned empty content (finish_reason=${data.choices?.[0]?.finish_reason})`;
  }
  // Strip thinking tags, including an unterminated one from a truncated reply.
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim();
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
    .replace(/\bThe (?:race|body type|role|theme|act|scene) is \S[^.!?]*[.!?]\s*/gi, '')
    .replace(/\bThe \w+ (?:is|are|was) \w+\.\s*/gi, '')
    .replace(/\s+The \w[^.!?]*$/, '')
    .trim();
}

function settingKeywords(setting) {
  return setting.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
}
function promptMatchesSetting(prompt, setting) {
  return settingKeywords(setting).some(w => prompt.toLowerCase().includes(w));
}


function filterAnimeTags(text, subject) {
  if (!text || typeof text !== 'string') return text;
  const BAD_ALWAYS = [/\bshota\b/i, /\bshouta\b/i, /\bshotacon\b/i, /\bloli\b/i, /\blolicon\b/i, /\blolikon\b/i, /\bunderage\b/i, /\bminor\b/i, /\bchild\b/i, /\bjailbait\b/i, /\bkiddie\b/i, /\bshota_con\b/i, /\bloli_con\b/i];
  const BAD_EXACT = new Set([
    'dslr','mirrorless','bokeh','softbox','editorial','lifestyle','candid','documentary',
    'shot on','raw photo','candid photography','editorial photography',
    'street photography','intimate photography','lifestyle photography',
    'softbox lighting','studio lighting','studio flash','studio softbox',
    'depth of field','shallow depth of field','hidden camera angle','hidden camera',
    'photo realistic','hyperrealistic','realistic anatomy','detailed skin texture',
    'detailed anatomy','realistic proportions','candid pose','candid shot','unposed',
    'film grain','vintage tone','warm skin tone',
    'warm lighting','warm_lighting','natural light','natural tones','natural_tones',
    'soft overcast lighting','natural light through slats','natural_window_light',
    'window light','window_light','morning light','morning_light',
    'cinematic composition','cinematic lighting','cinematic_lighting',
    'moody atmosphere','moody_atmosphere','rim light','rim_light','backlight',
    'phone camera','amateur','cool lighting','cool_lighting',
    'retro pinup','close up','close_up','wide shot','wide_shot','raw','soft focus','soft_focus',
  ]);
  const BAD_PARTIAL = [/\b(1[0-7]|[2-9])[-_ ]*years?[-_ ]*(old)?\b/i, /\bhigh[-_ ]?school[-_ ]?student/i, /\b(leica|canon|nikon|sony|fuji|hasselblad)\b/i, /\b\d{2,3}mm\b/i, /shallow.depth/i, /depth.of.field/i, /studio.light/i, /studio.flash/i, /softbox/i, /shot.on\b/i, /raw.photo/i, /\bcandid\b/i, /editorial.photo/i, /lifestyle.photo/i, /street.photo/i, /intimate.photo/i, /photography\b/i, /photoshoot/i, /shaky.cam/i, /realistic.prop/i, /detailed.anat/i, /\bgrainy\b/i, /film.grain/i, /hidden.camera/i, /\bunposed\b/i, /\bglistening\b/i, /\bhandheld\b/i, /cinematic/i, /warm.{1,15}light/i, /natural.light/i, /window.light/i, /morning.light/i, /retro.pinup/i, /\bclose.up\b/i, /wide.shot\b/i, /\d{4}s.style/i, /\bovercast\b/i, /soft.light/i, /golden.hour/i, /\bdappled\b/i, /vintage.filter/i, /vintage.tone/i, /motion.blur/i, /golden.light/i, /\bgleaming\b/i, /moody.light/i, /documentary/i, /boudoir/i, /voyeuristic.angle/i, /lens.flare/i, /lens.effect/i, /blue.hour/i, /unaware.subject/i, /distorted.lens/i, /\bamateur\b/i, /high.key\b/i, /artistic.nude/i, /high.production/i, /\bside.light/i, /\bunstaged\b/i, /posing.for.camera/i, /shallow.focus/i, /high.angle/i, /angle.from.above/i, /\bpinup\b/i, /\bvintage\b/i, /morning.sunlight/i, /bright.lighting/i, /sunlight.through/i];
  // Strip quality header tags — test against original tag (underscores intact), not norm
  const QUALITY_STRIP = /^(score_\d\w*|source_anime|source_\w+|rating:\w+|masterpiece|best_quality|best quality|ultra.detailed|newest)$/i;
  // Fix invalid duplicate count tags before splitting
  // Fix invalid/duplicate count tags
  text = text.replace(/\b1boy[\s,]+1boy\b/gi, '2boys').replace(/\b1girl[\s,]+1girl\b/gi, '2girls');
  // Fix 3-person count sequences (any order) → canonical booru form
  text = text.replace(/\b1boy[\s,]+1girl[\s,]+1girl\b/gi, '1boy 2girls');
  text = text.replace(/\b1girl[\s,]+1boy[\s,]+1girl\b/gi, '1boy 2girls');
  text = text.replace(/\b1girl[\s,]+1girl[\s,]+1boy\b/gi, '1boy 2girls');
  text = text.replace(/\b1boy[\s,]+1boy[\s,]+1girl\b/gi, '2boys 1girl');
  text = text.replace(/\b1girl[\s,]+1boy[\s,]+1boy\b/gi, '2boys 1girl');
  text = text.replace(/\b1boy[\s,]+1girl[\s,]+1boy\b/gi, '2boys 1girl');
  text = text.replace(/\b(1girl|1boy|2girls|2boys|3girls|3boys|1boy 1girl|1girl 1boy|1boy 2girls|2girls 1boy|2boys 1girl|1girl 2boys|2boys 2girls|2girls 2boys)(\s+)(?!,)([a-z])/gi, '$1, $3');
  const COUNT_TAG_EXACT = new Set([
    '1girl','1boy','2girls','2boys','3girls','3boys',
    '1boy 1girl','1girl 1boy','1boy 2girls','2girls 1boy',
    '2boys 1girl','1girl 2boys','2boys 2girls','2girls 2boys',
    '2men','2women','3men','3women',
    'solo female','solo male','male only','female only',
    'males only','females only','male_only','female_only'
  ]);
  const tags = text.split(',').map(t => t.trim()).filter(Boolean);
  const seen = new Set();
  const isMixedGender = subject ? (maleCount(subject) > 0 && (personCount(subject) - maleCount(subject)) > 0) : false;
  const isFemaleOnly = subject ? (maleCount(subject) === 0 && personCount(subject) > 0) : false;
  const GAY_MIXED = new Set(['male on male','homosexual','gay','yaoi','gay sex','male male','male on male sex','man penetrating man','man on man','male anal','prostate stimulation','prostate massage','homo eroticism','homoeroticism','male sex','three males','homoerotic','man giving head to man','man receiving head from man','man fucking man','man sucking man','man rimming man','man licking man']);
  const COUNT_IN_TAG = /\b(1\s*girl|1\s*boy|1\s*man|1\s*woman|2\s*girls|2\s*boys|2\s*men|2\s*women|3\s*girls|3\s*boys|3\s*men|3\s*women|two\s+(?:men|women|boys?|girls?)|three\s+(?:men|women|boys?|girls?)|\d+\s*guys?)\b/i;
  const kept = tags.filter(tag => {
    const tagLower = tag.toLowerCase();
    const norm = tagLower.replace(/_/g, ' ');
    if (seen.has(norm)) return false;
    seen.add(norm);
    if (QUALITY_STRIP.test(tagLower)) return false;
    if (COUNT_TAG_EXACT.has(norm)) return false;
    if (COUNT_IN_TAG.test(norm)) return false;
    if (isMixedGender && GAY_MIXED.has(norm)) return false;
    if (isMixedGender && /\bprostate\b/i.test(norm)) return false;
      if (isMixedGender && /\bman\b.{0,25}\bman\b/i.test(norm)) return false;
      if (isFemaleOnly && /\bman\b/i.test(norm)) return false;
      if (isFemaleOnly && /\b(cock|penis|deepthroat|blowjob|fellatio)\b/i.test(norm)) return false;
      if (isFemaleOnly && new Set(['creampie','facial','titfuck','paizuri','handjob','dp','bukakke','cum in pussy','impregnation','internal cumshot']).has(norm)) return false;
    if (BAD_ALWAYS.some(re => re.test(norm))) return false;
    if (BAD_EXACT.has(norm)) return false;
    if (BAD_PARTIAL.some(re => re.test(norm))) return false;
    return true;
  });
  const qualityList = QUALITY_TAGS.split(',').map(t => t.trim());
  let countTag = '';
  if (subject) {
    const males = maleCount(subject);
    const total = personCount(subject);
    const females = total - males;
    if (females >= 1 && males >= 1) {
      if      (females === 1 && males === 1) countTag = '1boy 1girl';
      else if (females === 2 && males === 1) countTag = '1boy 2girls';
      else if (females === 1 && males === 2) countTag = '2boys 1girl';
    } else if (females > 0) {
      countTag = females === 1 ? '1girl' : females === 2 ? '2girls' : '3girls';
    } else if (males > 0) {
      countTag = males === 1 ? '1boy' : males === 2 ? '2boys' : '3boys';
    }
  }
  const countPart = countTag ? [countTag] : [];
  return qualityList.concat(countPart).concat(kept).join(', ');
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

  const ALL_ROLES  = ROLE_RANDOM  ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'role' && modeOk(CATEGORIES[k]))  : null;
  const MALE_REQUIRED_ACTS  = new Set(['titfuck','handjob','facial','creampie','dp','bukakke']);
  const SOLO_ONLY_ACTS       = new Set(['joi','solo']);
  const MALE_REQUIRED_THEMES = new Set(['pegging','femdom','daddy_bg','breeding','cuckold']);
  const ALL_ACTS_FULL = ACT_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'act' && modeOk(CATEGORIES[k])) : null;
  const ALL_ACTS = (() => {
    if (!ALL_ACTS_FULL || !SUBJECT_ARG) return ALL_ACTS_FULL;
    return ALL_ACTS_FULL.filter(k => {
      const cat = CATEGORIES[k];
      if (isSoloFemale(SUBJECT_ARG) && !cat.solo_compatible) return false;
      if (cat.ff_only && hasMalePresent(SUBJECT_ARG)) return false;
      if (cat.multi_required && personCount(SUBJECT_ARG) < (k === 'bukakke' ? 4 : 3)) return false;
      if (MALE_REQUIRED_ACTS.has(k) && !hasMalePresent(SUBJECT_ARG)) return false;
      if (SOLO_ONLY_ACTS.has(k) && personCount(SUBJECT_ARG) > 1) return false;
      if (k === 'dp' && maleCount(SUBJECT_ARG) < 2) return false;
      return true;
    });
  })();
  const ALL_SCENES = SCENE_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'scene' && modeOk(CATEGORIES[k])) : null;
  const ALL_THEMES_FULL = THEME_RANDOM ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'theme' && modeOk(CATEGORIES[k])) : null;
  const ALL_THEMES = (() => {
    if (!ALL_THEMES_FULL || !SUBJECT_ARG) return ALL_THEMES_FULL;
    return ALL_THEMES_FULL.filter(k => {
      const cat = CATEGORIES[k];
      if (isSoloFemale(SUBJECT_ARG) && !cat.solo_compatible) return false;
      if (cat.multi_required && personCount(SUBJECT_ARG) < 3) return false;
      if (MALE_REQUIRED_THEMES.has(k) && !hasMalePresent(SUBJECT_ARG)) return false;
      if (k === 'swingers' && personCount(SUBJECT_ARG) < 4) return false;
      if (k === 'cuckold' && maleCount(SUBJECT_ARG) < 2) return false;
      return true;
    });
  })();
  const ALL_STYLES = STYLE_RANDOM ? Object.keys(CATEGORIES).filter(k => {
    const cat = CATEGORIES[k];
    return cat.type === 'style' && modeOk(cat);
  }) : null;
  const ALL_LIGHTINGS = LIGHTING_RANDOM ? Object.keys(CATEGORIES).filter(k => {
    const cat = CATEGORIES[k];
    return cat.type === 'lighting' && modeOk(cat);
  }) : null;
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
  if (HAND_ACTION_ARG)       parts.push(`hand_action=${HAND_ACTION_ARG}`);
  if (AGE_ARG)               parts.push(`age=${AGE_ARG}`);
  if (INTERRACIAL)           parts.push('interracial');
  if (HAIR_LENGTH_ARG)       parts.push(`hair_length=${HAIR_LENGTH_ARG}`);
  if (HAIR_STYLE_ARG)        parts.push(`hair_style=${HAIR_STYLE_ARG}`);
  if (FACIAL_HAIR_ARG)       parts.push(`facial_hair=${FACIAL_HAIR_ARG}`);
  console.log(`Generating ${COUNT} prompts | ${parts.join(' | ')}`);

  const db = new Database(DB_PATH);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO prompts (name, positive, tags, category, notes)
    VALUES (@name, @positive, @tags, @category, @notes)
  `);
  const exists = db.prepare('SELECT 1 FROM prompts WHERE positive = ?');

  let inserted = 0, failed = 0;

  const ALL_RACES     = RACE_RANDOM     ? Object.keys(CATEGORIES).filter(k => CATEGORIES[k].type === 'race' && !k.startsWith('ct_')) : null;
  // Base body types only - the picker excludes modifiers and petite_teen from
  // its base list, so a random base must too.
  const ALL_BODYTYPES = BODYTYPE_RANDOM ? Object.keys(CATEGORIES).filter(k =>
    CATEGORIES[k].type === 'body_type' && !MODIFIER_BODYTYPES.has(k) && k !== 'petite_teen') : null;
  // Captured once: re-reading BODYTYPE_NAMES each pass would accumulate the
  // modifiers from the previous prompt.
  const USER_MODIFIERS = BODYTYPE_NAMES.filter(n => MODIFIER_BODYTYPES.has(n));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

  for (let i = 0; i < COUNT; i++) {
    if (ALL_RACES && ALL_RACES.length) RACE_ARG = pickOne(ALL_RACES);
    if (HAIR_COLOR_RANDOM) HAIR_COLOR_ARG = pickOne(HAIR_COLOR_POOL);
    if (HAIR_LENGTH_RANDOM) HAIR_LENGTH_ARG = pickOne(HAIR_LENGTH_POOL);
    if (HAIR_STYLE_RANDOM) HAIR_STYLE_ARG = pickOne(HAIR_STYLE_POOL);
    if (FACIAL_EXPRESSION_RANDOM) {
      // ahegao is a manga convention, and the expression rule is ABSOLUTE, so a
      // realistic run would be forced to render it photographically.
      const exprPool = MODE_ARG === 'anime'
        ? FACIAL_EXPRESSION_POOL
        : FACIAL_EXPRESSION_POOL.filter(e => e !== 'ahegao');
      FACIAL_EXPRESSION_ARG = pickOne(exprPool);
    }
    if (EYE_COLOR_RANDOM) EYE_COLOR_ARG = pickOne(EYE_COLOR_POOL);
    if (ALL_BODYTYPES && ALL_BODYTYPES.length) {
      BODYTYPE_NAMES = [pickOne(ALL_BODYTYPES), ...USER_MODIFIERS];
      BODYTYPE_ARG = BODYTYPE_NAMES.join(',');
    }
    const actName   = ALL_ACTS   ? ALL_ACTS[Math.floor(Math.random()   * ALL_ACTS.length)]   : (actNames.length   ? pick(actNames)   : null);
    const sceneName = ALL_SCENES ? ALL_SCENES[Math.floor(Math.random() * ALL_SCENES.length)] : (sceneNames.length ? pick(sceneNames) : null);
    const themeName = ALL_THEMES ? ALL_THEMES[Math.floor(Math.random() * ALL_THEMES.length)] : (themeNames.length ? pick(themeNames) : null);
    const actCat    = actName   ? CATEGORIES[actName]   : null;
    const sceneCat  = sceneName ? CATEGORIES[sceneName] : null;
    const themeCat  = themeName ? CATEGORIES[themeName] : null;
    const effectiveRole  = ROLE_RANDOM  ? ALL_ROLES[Math.floor(Math.random()  * ALL_ROLES.length)]  : ROLE_ARG;
    const effectiveStyle = (DATASET_MODE || !STYLE_RANDOM) ? STYLE_ARG : (ALL_STYLES?.length ? ALL_STYLES[Math.floor(Math.random() * ALL_STYLES.length)] : null);
    let effectiveLighting = (DATASET_MODE || !LIGHTING_RANDOM) ? LIGHTING_ARG : (ALL_LIGHTINGS?.length ? ALL_LIGHTINGS[Math.floor(Math.random() * ALL_LIGHTINGS.length)] : null);

    const skeleton  = buildSkeleton(actCat, sceneCat, themeCat, effectiveRole, effectiveStyle);
    if (sceneName && SCENE_SETTING_MAP[sceneName]) skeleton.setting = SCENE_SETTING_MAP[sceneName];
    if (sceneName && SCENE_LIGHTING_MAP[sceneName]) {
      const opts = SCENE_LIGHTING_MAP[sceneName];
      skeleton.lighting = opts[Math.floor(Math.random() * opts.length)];
    } else if (LIGHTING_RANDOM && !DATASET_MODE) {
      // Fallback for when no lighting category is available to speak for the
      // setting. Dataset mode has its own lighting vocabulary, and an explicit
      // --lighting is a deliberate choice, so neither is second-guessed.
      const allowed = lightingForSetting(skeleton.setting);
      if (allowed && !allowed.includes(skeleton.lighting)) {
        skeleton.lighting = allowed[Math.floor(Math.random() * allowed.length)];
      }
    }

    // The lighting category describes the light through its own `emphasis`, and
    // it was drawn independently of skeleton.lighting, so the two disagreed in
    // half of all prompts. Re-pick the category to suit the setting, then let it
    // set skeleton.lighting as well — one source, one description.
    if (LIGHTING_RANDOM && !DATASET_MODE && effectiveLighting) {
      const classes = settingLightClasses(skeleton.setting);
      const current = LIGHT_CAT_CLASS[effectiveLighting] || 'any';
      if (!classes.includes(current)) {
        const fits = (ALL_LIGHTINGS || []).filter(n => classes.includes(LIGHT_CAT_CLASS[n] || 'any'));
        if (fits.length) effectiveLighting = fits[Math.floor(Math.random() * fits.length)];
      }
      if (LIGHT_CAT_PHRASE[effectiveLighting]) skeleton.lighting = LIGHT_CAT_PHRASE[effectiveLighting];
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
        (resolvedActCat?.multi_required && personCount(subj) < (resolvedActName === 'bukakke' ? 4 : 3)) ||
        (MALE_REQUIRED_ACTS.has(resolvedActName) && !hasMalePresent(subj)) ||
        (SOLO_ONLY_ACTS.has(resolvedActName) && personCount(subj) > 1) ||
        (resolvedActName === 'dp' && maleCount(subj) < 2);
      if (actIncompat) {
        const compatible = ALL_ACTS_FULL.filter(k => {
          const cat = CATEGORIES[k];
          if (isSoloFemale(subj) && !cat.solo_compatible) return false;
          if (cat.ff_only && hasMalePresent(subj)) return false;
          if (cat.multi_required && personCount(subj) < (k === 'bukakke' ? 4 : 3)) return false;
          if (MALE_REQUIRED_ACTS.has(k) && !hasMalePresent(subj)) return false;
          if (SOLO_ONLY_ACTS.has(k) && personCount(subj) > 1) return false;
          if (k === 'dp' && maleCount(subj) < 2) return false;
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
        (CATEGORIES[resolvedThemeName]?.multi_required && personCount(subj) < 3) ||
        (MALE_REQUIRED_THEMES.has(resolvedThemeName) && !hasMalePresent(subj)) ||
        (resolvedThemeName === 'swingers' && personCount(subj) < 4) ||
        (resolvedThemeName === 'cuckold' && maleCount(subj) < 2);
      if (themeIncompat) {
        const compatThemes = ALL_THEMES_FULL.filter(k => {
          const cat = CATEGORIES[k];
          if (isSoloFemale(subj) && !cat.solo_compatible) return false;
          if (cat.multi_required && personCount(subj) < 3) return false;
          if (MALE_REQUIRED_THEMES.has(k) && !hasMalePresent(subj)) return false;
          if (k === 'swingers' && personCount(subj) < 4) return false;
          if (k === 'cuckold' && maleCount(subj) < 2) return false;
          return true;
        });
        if (compatThemes.length) resolvedThemeName = compatThemes[Math.floor(Math.random() * compatThemes.length)];
      }
    }
    const resolvedThemeCat = resolvedThemeName ? CATEGORIES[resolvedThemeName] : null;
    if (resolvedThemeName && resolvedThemeName !== themeName) skeleton.theme = resolvedThemeCat?.label?.split(' —')[0] || resolvedThemeName;

    const loopRoleCat  = effectiveRole  ? CATEGORIES[effectiveRole]  : null;
    const loopStyleCat = effectiveStyle ? CATEGORIES[effectiveStyle] : null;
    const loopLightingCat = effectiveLighting ? CATEGORIES[effectiveLighting] : null;
    const catTag = [resolvedActName, sceneName, resolvedThemeName].filter(Boolean).map(n => `[${n}]`).join('');
    const tags = [catTag, RACE_ARG ? `[${RACE_ARG}]` : '', BODYTYPE_ARG ? `[${BODYTYPE_ARG}]` : '', effectiveRole ? `[${effectiveRole}]` : '', effectiveStyle ? `[${effectiveStyle}]` : '', effectiveLighting ? `[${effectiveLighting}]` : '', HAND_ACTION_ARG ? `[${HAND_ACTION_ARG}]` : ''].filter(Boolean).join('');
    process.stdout.write(`  [${i+1}/${COUNT}]${tags ? ' ' + tags : ''} ${skeleton.subject} / ${skeleton.setting}... `);

    try {
      let prompt = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = await generatePrompt(skeleton, resolvedActCat, sceneCat, resolvedThemeCat, loopRoleCat, loopLightingCat);
        if (!candidate || candidate.length < 40) {
          if (candidate && candidate.trim()) LAST_SKIP_REASON = `only ${candidate.length} chars: ${JSON.stringify(candidate.slice(0, 80))}`;
          continue;
        }
        prompt = candidate;
        if (MODE_ARG === 'anime') prompt = filterAnimeTags(prompt, skeleton.subject || SUBJECT_ARG);
        break;
      }
      if (!prompt) { console.log(`skip - ${LAST_SKIP_REASON || 'no usable output from model'}`); LAST_SKIP_REASON = ''; failed++; continue; }
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
