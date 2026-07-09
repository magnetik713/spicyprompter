// NSFW prompt categories — add new ones here, llm_generator.js picks them up automatically
// Each key becomes the --category flag value and the DB category tag
// All fields optional — unset fields fall back to DEFAULTS in llm_generator.js

module.exports = {

  // ── Solo / Individual ─────────────────────────────────────────────────────

  boudoir: {
    label: 'Boudoir — lingerie, bedroom, editorial',
    subjects:  ['woman in her 20s','woman in her 30s','woman'],
    settings:  ['bedroom','hotel room','studio','dressing room'],
    clothing:  ['in lingerie','in sheer negligee','topless in robe','wearing only stockings and heels','in lace bodysuit'],
    styles:    ['editorial photography','boudoir photography','professional photoshoot','intimate photography'],
    lighting:  ['studio softbox lighting','natural window light','candlelight','golden hour sunlight'],
    emphasis:  'Boudoir style. Sensual, elegant. Lingerie or partial nudity. Soft feminine aesthetic. Bedroom or studio.',
  },

  solo: {
    label: 'Solo — masturbation, self-pleasure, vibrator',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['bedroom','bathroom','living room sofa','studio','hotel room'],
    clothing:  ['fully nude','nude with vibrator','in lingerie pulled aside','nude on bed'],
    styles:    ['intimate photography','candid photography','editorial photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Solo female masturbation. Nude or nearly nude. Self-pleasure, vibrator, or fingers. Explicit, intimate, raw.',
  },

  glamour: {
    label: 'Glamour — studio, artistic nude, fashion editorial',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['studio','rooftop at night','hotel room','penthouse'],
    clothing:  ['fully nude','artfully nude','in sheer fabric','wearing only heels','in open blazer with nothing underneath'],
    styles:    ['editorial photography','professional photoshoot','artistic nude','fashion photography'],
    lighting:  ['studio softbox lighting','dramatic side lighting','golden hour sunlight'],
    emphasis:  'Glamour or fashion nude. High production. Studio or luxury setting. Artistic, editorial aesthetic.',
  },

  milf: {
    label: 'MILF — mature woman 35-50, domestic, sensual',
    subjects:  ['woman in her late 30s','woman in her 40s','woman in her early 50s'],
    settings:  ['bedroom','kitchen','living room sofa','bathroom','backyard'],
    clothing:  ['topless','fully nude','in lingerie','partially undressed','wearing only an apron'],
    styles:    ['candid photography','lifestyle photography','intimate photography'],
    lighting:  ['natural window light','golden hour sunlight','soft overcast daylight'],
    emphasis:  'MILF. Mature woman 35-50, confident, sensual. Domestic or home setting. Experienced, explicitly sexual.',
  },

  mature: {
    label: 'Mature — 40s-50s woman, experienced, sensual',
    subjects:  ['woman in her 40s','woman in her 50s','mature woman'],
    settings:  ['bedroom','hotel room','living room','bathroom','garden'],
    clothing:  ['in lingerie','topless','fully nude','partially undressed'],
    styles:    ['intimate photography','editorial photography','lifestyle photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Mature woman 40s-50s. Confident, experienced, sensual. Real body, natural. Explicitly sexual.',
  },

  petite: {
    label: 'Petite — small frame, slim, compact body type',
    subjects:  ['petite woman','slim woman in her 20s','petite woman in her 20s'],
    settings:  ['bedroom','studio','hotel room','bathroom'],
    clothing:  ['fully nude','in oversized shirt with nothing underneath','in tiny lingerie','topless'],
    styles:    ['intimate photography','editorial photography','candid photography'],
    lighting:  ['natural window light','studio softbox lighting','golden hour sunlight'],
    emphasis:  'Petite subject. Small, slim frame. Compact body. Explicit nudity, full detail of petite physique.',
  },

  bbw: {
    label: 'BBW — full figured, plus size, curvy',
    subjects:  ['full-figured woman','plus-size woman in her 20s','curvy plus-size woman in her 30s'],
    settings:  ['bedroom','studio','hotel room','living room sofa'],
    clothing:  ['fully nude','in lingerie','topless','partially undressed'],
    styles:    ['intimate photography','editorial photography','boudoir photography'],
    lighting:  ['studio softbox lighting','natural window light','candlelight'],
    emphasis:  'BBW — full-figured, plus-size woman. Celebrate curves. Explicit, confident, nude or nearly nude.',
  },

  busty: {
    label: 'Busty — large natural breasts, topless emphasis',
    subjects:  ['naturally busty woman','busty woman in her 20s','large-breasted woman in her 30s'],
    settings:  ['bedroom','beach','studio','pool','hotel room'],
    clothing:  ['topless','in unbuttoned shirt','fully nude','in sheer bra'],
    styles:    ['editorial photography','lifestyle photography','candid photography'],
    lighting:  ['natural window light','golden hour sunlight','studio softbox lighting'],
    emphasis:  'Busty subject with large natural breasts. Emphasize chest explicitly. Topless or nude. Real, natural.',
  },

  petite_teen: {
    label: '18+ Teen — young adult 18-19, college age',
    subjects:  ['woman who is 18 years old','woman who just turned 18','18-year-old woman','college freshman woman'],
    settings:  ['dorm room','bedroom','bathroom','campus outdoors'],
    clothing:  ['in a tiny bikini','in lingerie','topless','fully nude','in just underwear'],
    styles:    ['candid photography','lifestyle photography','intimate photography'],
    lighting:  ['natural window light','golden hour sunlight','soft overcast daylight'],
    emphasis:  'Subject is 18-19 years old, legal adult. Young, fresh, candid. Explicit nudity. College or dorm setting.',
  },

  pregnant: {
    label: 'Pregnant — visibly pregnant woman, nude or lingerie',
    subjects:  ['visibly pregnant woman','heavily pregnant woman in her 20s','pregnant woman in her 30s'],
    settings:  ['bedroom','studio','bathroom','living room'],
    clothing:  ['nude with round belly','in maternity lingerie','topless showing belly','partially undressed'],
    styles:    ['intimate photography','artistic nude','editorial photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Visibly pregnant woman. Celebrate pregnant body. Nude or lingerie. Explicitly sensual. Round belly prominent.',
  },

  // ── Settings / Scenarios ──────────────────────────────────────────────────

  outdoor: {
    label: 'Outdoor — nature, parks, natural light, candid',
    subjects:  ['woman','woman in her 20s','woman in her 30s','two women'],
    settings:  ['outdoor park','forest clearing','beach','rooftop at night','balcony','mountain trail','secluded garden'],
    clothing:  ['topless','nude','in sheer sundress with nothing underneath','wearing only an unbuttoned shirt','partially undressed'],
    styles:    ['candid photography','documentary style','lifestyle photography','voyeuristic candid'],
    lighting:  ['golden hour sunlight','natural window light','soft overcast daylight','harsh midday sun','blue hour'],
    emphasis:  'Outdoor setting. Natural light. Nude or topless in nature. Candid, unposed feel.',
  },

  beach: {
    label: 'Beach — sand, ocean, topless, golden hour',
    subjects:  ['woman','woman in her 20s','two women','man and woman'],
    settings:  ['beach','ocean shore','secluded cove','beach cabana','poolside'],
    clothing:  ['topless in bikini bottoms','fully nude','wearing a thong bikini','nude sunbathing','in wet see-through swimwear'],
    styles:    ['candid photography','lifestyle photography','editorial photography'],
    lighting:  ['golden hour sunlight','harsh midday sun','soft overcast daylight'],
    emphasis:  'Beach or poolside. Tanned skin. Water, sand. Topless or nude. Relaxed and sensual.',
  },

  pool: {
    label: 'Pool / Hot Tub — wet, poolside, summer',
    subjects:  ['woman','woman in her 20s','two women','man and woman'],
    settings:  ['swimming pool','hot tub','pool deck','luxury pool at night'],
    clothing:  ['in wet bikini','topless by pool','fully nude in pool','nude in hot tub','in wet see-through swimsuit'],
    styles:    ['lifestyle photography','candid photography','editorial photography'],
    lighting:  ['golden hour sunlight','neon signs at night','harsh midday sun'],
    emphasis:  'Pool or hot tub setting. Wet skin. Poolside nude or topless. Summer, water, heat.',
  },

  shower: {
    label: 'Shower — wet, nude, steam, bathroom',
    subjects:  ['woman','woman in her 20s','woman in her 30s','two women'],
    settings:  ['shower','bathroom','spa','steam room','outdoor shower'],
    clothing:  ['fully nude','nude and wet','nude in steam'],
    styles:    ['intimate photography','artistic nude','candid photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Shower or bathroom. Nude and wet. Steam. Water on skin. Intimate and raw.',
  },

  office: {
    label: 'Office — workplace, secretary, boss scenario',
    subjects:  ['woman in her 20s','woman in her 30s','man and woman'],
    settings:  ['office','corporate boardroom','secretary desk','business hotel room','conference room'],
    clothing:  ['in business suit being undressed','topless in office','in blouse and skirt being removed','nude at desk','secretary in heels only'],
    styles:    ['candid photography','editorial photography','lifestyle photography'],
    lighting:  ['studio softbox lighting','natural window light','blue hour'],
    emphasis:  'Office or workplace scenario. Professional attire being removed. Power dynamic. Secretary/boss. Explicit and detailed.',
  },

  massage: {
    label: 'Massage — massage table, oiled, sensual touch',
    subjects:  ['woman','woman in her 20s','woman in her 30s','man and woman'],
    settings:  ['massage parlor','spa room','hotel room massage table','luxury spa'],
    clothing:  ['nude on massage table','nude and oiled','draped in towel being removed','fully nude'],
    styles:    ['intimate photography','lifestyle photography','editorial photography'],
    lighting:  ['candlelight','studio softbox lighting','natural window light'],
    emphasis:  'Massage setting. Oiled skin, massage table. Sensual touch escalating to explicit. Nude and glistening.',
  },

  gym: {
    label: 'Gym / Locker Room — athletic, sweaty, sporty',
    subjects:  ['athletic woman','fit woman in her 20s','muscular woman in her 30s'],
    settings:  ['gym locker room','yoga studio','gym changing room','fitness studio'],
    clothing:  ['in sports bra and leggings being removed','nude in locker room','topless after workout','fully nude after shower'],
    styles:    ['candid photography','documentary style','lifestyle photography'],
    lighting:  ['harsh midday sun','studio softbox lighting','natural window light'],
    emphasis:  'Gym or locker room setting. Athletic, sweaty body. Post-workout nude or undressing. Fit physique, explicit.',
  },

  car: {
    label: 'Car / Van — vehicle sex, roadside, parking lot',
    subjects:  ['woman','man and woman','woman in her 20s'],
    settings:  ['car interior','van backseat','parking garage','roadside at night','car in secluded spot'],
    clothing:  ['nude in backseat','partially undressed in car','topless in passenger seat','clothes pushed aside'],
    styles:    ['candid photography','voyeuristic candid','documentary style'],
    lighting:  ['neon signs at night','blue hour','harsh midday sun','natural window light'],
    emphasis:  'Car or vehicle setting. Sex in backseat, van, or SUV. Cramped, intimate, raw. Explicit positions in confined space.',
  },

  college: {
    label: 'College — dorm room, campus, student',
    subjects:  ['woman who is 18 years old','college student woman 18+','woman in her early 20s'],
    settings:  ['dorm room','college apartment','campus bedroom','student house'],
    clothing:  ['in a crop top and shorts being removed','nude in dorm','topless in bed','in lingerie'],
    styles:    ['candid photography','lifestyle photography','amateur photography'],
    lighting:  ['natural window light','neon signs at night','soft overcast daylight'],
    emphasis:  'College dorm or campus. 18+ student. Casual, youthful, uninhibited. Explicit, raw amateur feel.',
  },

  maid: {
    label: 'Maid — uniform, cleaning, domestic service',
    subjects:  ['woman in her 20s','woman in her 30s','man and woman'],
    settings:  ['bedroom being cleaned','hotel room','mansion interior','bathroom'],
    clothing:  ['in maid uniform being removed','topless in maid apron','nude in maid headband only','maid skirt lifted'],
    styles:    ['editorial photography','lifestyle photography','candid photography'],
    lighting:  ['natural window light','studio softbox lighting'],
    emphasis:  'Maid uniform scenario. Cleaning uniform being removed or lifted. Explicit service role. Costume detail.',
  },

  medical: {
    label: 'Medical — nurse, doctor, examination room',
    subjects:  ['woman in her 20s','woman in her 30s','man and woman'],
    settings:  ['hospital examination room','medical office','doctor office','clinic'],
    clothing:  ['in nurse uniform being removed','nude on examination table','in hospital gown opened','topless during exam'],
    styles:    ['editorial photography','documentary style','candid photography'],
    lighting:  ['studio softbox lighting','natural window light'],
    emphasis:  'Medical setting. Nurse or doctor scenario. Examination table, clinical environment. Costume removed explicitly.',
  },

  teacher: {
    label: 'Teacher — classroom, student-teacher, school fantasy',
    subjects:  ['woman in her 30s','woman in her 20s','man and woman'],
    settings:  ['classroom after hours','teacher office','school library','lecture room'],
    clothing:  ['in teacher outfit being undressed','topless in classroom','nude at chalkboard','pencil skirt removed'],
    styles:    ['editorial photography','candid photography','lifestyle photography'],
    lighting:  ['natural window light','studio softbox lighting'],
    emphasis:  'Teacher-student power dynamic fantasy. Classroom or office setting. Professional clothing removed explicitly.',
  },

  cheerleader: {
    label: 'Cheerleader — uniform, sporty, college fantasy',
    subjects:  ['woman in her 20s','athletic woman in her 20s'],
    settings:  ['locker room','empty stadium','bedroom','dorm room'],
    clothing:  ['in cheerleader uniform being removed','topless in cheerleader skirt','uniform pulled aside','nude with pom poms'],
    styles:    ['candid photography','editorial photography'],
    lighting:  ['natural window light','studio softbox lighting','harsh midday sun'],
    emphasis:  'Cheerleader uniform fantasy. Sporty, athletic woman. Uniform removed or lifted explicitly. Energetic, playful.',
  },

  voyeur: {
    label: 'Voyeur — candid, unaware, public, documentary',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['changing room','urban alley','outdoor park','hotel balcony','rooftop at night','parking garage'],
    clothing:  ['partially undressed','topless','nude','in underwear unaware of camera'],
    styles:    ['voyeuristic candid','documentary style','candid photography'],
    lighting:  ['natural window light','neon signs at night','blue hour','soft overcast daylight'],
    emphasis:  'Voyeuristic. Subject unaware. Hidden camera aesthetic. Candid, raw, unstaged.',
  },

  // ── Explicit Acts ─────────────────────────────────────────────────────────

  oral: {
    label: 'Oral — explicit oral sex scenes',
    subjects:  ['man and woman','two women','woman'],
    settings:  ['bedroom','hotel room','living room sofa','studio'],
    clothing:  ['fully nude','partially undressed','nude mid-act'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Explicit oral sex scene. Graphic description of the act — fellatio or cunnilingus. Describe position, eye contact, and explicit anatomical detail.',
  },

  anal: {
    label: 'Anal — explicit anal sex, positions',
    subjects:  ['man and woman','two women with strap-on','woman'],
    settings:  ['bedroom','hotel room','living room sofa','studio'],
    clothing:  ['fully nude mid-anal sex'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Explicit anal sex. Describe the specific act and position graphically. Penetration detail, anatomical explicitness.',
  },

  facial: {
    label: 'Facial / Cumshot — explicit finish on face',
    subjects:  ['man and woman','woman in her 20s','woman in her 30s'],
    settings:  ['bedroom','hotel room','studio','living room'],
    clothing:  ['partially undressed','nude','kneeling nude'],
    styles:    ['candid photography','intimate photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Explicit cumshot or facial scene. Woman receiving cum on face or body. Describe aftermath explicitly.',
  },

  creampie: {
    label: 'Creampie — internal finish, explicit aftermath',
    subjects:  ['man and woman','woman'],
    settings:  ['bedroom','hotel room','living room sofa'],
    clothing:  ['fully nude post-sex','nude lying on bed'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Creampie scene. Internal finish, explicit aftermath. Describe the scene graphically.',
  },

  squirting: {
    label: 'Squirting — female ejaculation, explicit',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['bedroom','studio','bathroom','hotel room'],
    clothing:  ['fully nude','nude during orgasm'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Squirting / female ejaculation. Explicit orgasm scene. Describe the act graphically.',
  },

  handjob: {
    label: 'Handjob — manual stimulation, explicit',
    subjects:  ['man and woman','woman in her 20s and man'],
    settings:  ['bedroom','living room sofa','hotel room'],
    clothing:  ['partially undressed','woman in lingerie with man nude','nude'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Handjob scene. Woman manually stimulating man. Explicit, graphic, close detail.',
  },

  rimming: {
    label: 'Rimming — oral-anal, explicit',
    subjects:  ['man and woman','two women'],
    settings:  ['bedroom','hotel room','studio'],
    clothing:  ['fully nude'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Rimming / analingus scene. Explicit oral-anal contact. Describe position and act graphically.',
  },

  titfuck: {
    label: 'Titfuck — paizuri, breast sex, explicit',
    subjects:  ['man and busty woman','naturally busty woman and man'],
    settings:  ['bedroom','hotel room','studio','living room sofa'],
    clothing:  ['topless woman with man nude','nude'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Titfuck / paizuri scene. Man between large breasts. Explicit, graphic detail. Describe act and position.',
  },

  // ── Multi-Person Explicit ─────────────────────────────────────────────────

  couple: {
    label: 'Couple — man and woman, explicit sex, positions',
    subjects:  ['man and woman','couple'],
    settings:  ['bedroom','hotel room','living room sofa','outdoor location','bathroom'],
    clothing:  ['fully nude','nude mid-sex','undressing each other'],
    styles:    ['intimate photography','candid photography','lifestyle photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting','golden hour sunlight'],
    emphasis:  'Explicit heterosexual sex between a couple. Describe specific sexual position graphically. Penetrative sex, real bodies, raw and intimate. Name the position being performed.',
  },

  lesbian: {
    label: 'Lesbian — two women, explicit, intimate',
    subjects:  ['two women'],
    settings:  ['bedroom','hotel room','bathroom','studio','living room sofa'],
    clothing:  ['fully nude','nude and entwined','partially undressed together'],
    styles:    ['intimate photography','editorial photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Explicit lesbian sex between two women. Graphic and intimate. Describe specific acts — oral, fingering, scissoring, strap-on. Real bodies, passionate.',
  },

  threesome: {
    label: 'Threesome — three people, various combos',
    subjects:  ['two women and a man','woman with two men','three women','two men and a woman'],
    settings:  ['bedroom','hotel room','living room','studio'],
    clothing:  ['fully nude','nude mid-sex'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Explicit threesome sex. Three people engaged simultaneously. Describe positions and acts graphically — who is doing what to whom. Real, raw, explicit.',
  },

  gangbang: {
    label: 'Gangbang — one woman, multiple men',
    subjects:  ['woman surrounded by multiple men','woman with three men','woman with four men'],
    settings:  ['bedroom','hotel room','studio','living room'],
    clothing:  ['fully nude','nude mid-sex'],
    styles:    ['intimate photography','candid photography','documentary style'],
    lighting:  ['studio softbox lighting','natural window light','candlelight'],
    emphasis:  'Explicit gangbang scene. One woman with multiple men simultaneously. Describe all concurrent acts graphically. Real bodies, intense, explicit.',
  },

  orgy: {
    label: 'Orgy — multiple people, group sex',
    subjects:  ['group of four people','three women and two men','mixed group of five'],
    settings:  ['bedroom','hotel suite','living room','studio'],
    clothing:  ['all fully nude','nude group mid-sex'],
    styles:    ['candid photography','documentary style','intimate photography'],
    lighting:  ['studio softbox lighting','candlelight','natural window light'],
    emphasis:  'Explicit group sex with multiple people. Describe who is engaged with whom, specific positions and acts. Chaotic, raw, explicit photography.',
  },

  swingers: {
    label: 'Swingers — lifestyle, partner swap, group',
    subjects:  ['two couples','man and woman with another couple'],
    settings:  ['swinger party','hotel suite','living room','bedroom'],
    clothing:  ['fully nude','nude mid-swap'],
    styles:    ['candid photography','documentary style','lifestyle photography'],
    lighting:  ['candlelight','neon signs at night','natural window light'],
    emphasis:  'Swinger lifestyle scene. Partner exchange, group sex between two couples. Explicit, consenting, detailed.',
  },

  cuckold: {
    label: 'Cuckold / Hotwife — wife with another man, watching',
    subjects:  ['woman with man while husband watches','hotwife and bull'],
    settings:  ['bedroom','hotel room'],
    clothing:  ['fully nude','nude mid-sex'],
    styles:    ['candid photography','documentary style'],
    lighting:  ['natural window light','candlelight'],
    emphasis:  'Hotwife/cuckold scenario. Wife explicit with another man. Describe acts graphically. Voyeur element.',
  },

  // ── Positions ─────────────────────────────────────────────────────────────

  positions: {
    label: 'Positions — explicit focus on sexual positions',
    subjects:  ['man and woman','two women','couple'],
    settings:  ['bedroom','hotel room','studio','living room sofa'],
    clothing:  ['fully nude mid-sex'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Explicit focus on a specific sexual position. Choose one: missionary, doggy style, cowgirl, reverse cowgirl, standing, spooning, prone bone, pile driver, lotus. Name and describe the position graphically with full anatomical detail.',
  },

  dp: {
    label: 'Double Penetration — explicit DP scene',
    subjects:  ['woman with two men'],
    settings:  ['bedroom','hotel room','studio'],
    clothing:  ['fully nude mid-sex'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Explicit double penetration scene. Two men simultaneously penetrating one woman. Describe positions and acts graphically with anatomical detail.',
  },

  pov: {
    label: 'POV — first person perspective, immersive',
    subjects:  ['woman','woman in her 20s','woman in her 30s','two women'],
    settings:  ['bedroom','hotel room','bathroom','living room sofa'],
    clothing:  ['fully nude','in lingerie','partially undressed','nude mid-sex'],
    styles:    ['POV photography','first-person perspective','candid photography'],
    lighting:  ['natural window light','candlelight','soft overcast daylight'],
    emphasis:  'First-person POV perspective. Camera is the viewer\'s eyes. Subject facing or engaging directly with camera. Immersive, intimate. Shot from below or directly ahead.',
  },

  // ── Fetish / BDSM ─────────────────────────────────────────────────────────

  bondage: {
    label: 'Bondage — restraints, rope, BDSM, power dynamic',
    subjects:  ['woman','woman in her 20s','woman in her 30s','man and woman'],
    settings:  ['bedroom','studio','dungeon-style room','hotel room'],
    clothing:  ['nude in rope bondage','in restraints','wearing only leather harness','bound and nude'],
    styles:    ['editorial photography','artistic nude','intimate photography'],
    lighting:  ['dramatic side lighting','candlelight','studio softbox lighting'],
    emphasis:  'BDSM or bondage scene. Rope bondage, restraints, or power dynamic. Dominant and submissive roles. Describe restraints, position, and power exchange explicitly.',
  },

  femdom: {
    label: 'Femdom — female domination, mistress, submissive man',
    subjects:  ['dominant woman and submissive man','mistress and male sub'],
    settings:  ['dungeon-style room','bedroom','studio'],
    clothing:  ['woman in leather dominatrix outfit','woman in latex with man nude and restrained','mistress in heels only'],
    styles:    ['editorial photography','artistic nude'],
    lighting:  ['dramatic side lighting','candlelight','neon signs at night'],
    emphasis:  'Female domination scene. Confident dominant woman, submissive male. Power exchange. Describe acts, restraints, humiliation explicitly.',
  },

  pegging: {
    label: 'Pegging — woman using strap-on on man',
    subjects:  ['man and woman','dominant woman and man'],
    settings:  ['bedroom','hotel room','studio'],
    clothing:  ['woman in strap-on harness with man nude','partially dressed woman, nude man'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Pegging scene. Woman penetrating man with strap-on. Explicit, describe positions and acts graphically. Role reversal.',
  },

  joi: {
    label: 'JOI — jerk off instructions, direct address to camera',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['bedroom','studio','hotel room'],
    clothing:  ['in lingerie','topless','nude','in sheer outfit'],
    styles:    ['POV photography','editorial photography','intimate photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'JOI — jerk off instruction scene. Woman directly addresses camera viewer. Intimate, commanding, explicit. POV feel.',
  },

  footfetish: {
    label: 'Foot Fetish — feet worship, stockings, heels',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['bedroom','studio','living room sofa'],
    clothing:  ['nude with painted toes','in stockings and heels','in ankle socks only','barefoot nude'],
    styles:    ['editorial photography','intimate photography','candid photography'],
    lighting:  ['studio softbox lighting','natural window light','candlelight'],
    emphasis:  'Foot fetish scene. Explicit focus on bare feet, painted nails, stockings, heels. Describe foot detail prominently.',
  },

  stockings: {
    label: 'Stockings / Pantyhose — hosiery, garter, heels',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['bedroom','studio','hotel room','dressing room'],
    clothing:  ['in thigh-high stockings and garter with nothing else','in pantyhose being torn','in stockings and heels only','nude except stockings'],
    styles:    ['editorial photography','boudoir photography','artistic nude'],
    lighting:  ['studio softbox lighting','candlelight','natural window light'],
    emphasis:  'Stockings, pantyhose, or garter belt focus. Hosiery on nude or nearly nude body. Describe texture and detail explicitly.',
  },

  latex: {
    label: 'Latex / Rubber — catsuit, shiny, skin-tight',
    subjects:  ['woman','woman in her 20s','woman in her 30s'],
    settings:  ['studio','dungeon-style room','bedroom'],
    clothing:  ['in latex catsuit','in rubber bodysuit unzipped','wearing only latex gloves and boots','latex outfit partially removed'],
    styles:    ['editorial photography','fashion photography','artistic nude'],
    lighting:  ['dramatic side lighting','studio softbox lighting','neon signs at night'],
    emphasis:  'Latex or rubber outfit. Shiny, skin-tight material. Describe the texture, fit, and how it is removed or worn. Explicit.',
  },

  oiled: {
    label: 'Oiled — glistening skin, body oil, slick',
    subjects:  ['woman','woman in her 20s','two women','man and woman'],
    settings:  ['studio','massage parlor','bedroom','pool deck'],
    clothing:  ['fully nude and oiled','in bikini and oiled'],
    styles:    ['editorial photography','artistic nude','lifestyle photography'],
    lighting:  ['studio softbox lighting','golden hour sunlight','dramatic side lighting'],
    emphasis:  'Oiled body. Glistening, slick skin from body oil. Describe the sheen and how light plays off oiled skin explicitly.',
  },

  cosplay: {
    label: 'Cosplay — costume, character, fantasy outfit',
    subjects:  ['woman in cosplay','woman in her 20s in costume'],
    settings:  ['studio','bedroom','fantasy set'],
    clothing:  ['in anime cosplay being removed','in superhero costume unzipped','in fantasy outfit stripped','in maid cosplay','nurse cosplay undone'],
    styles:    ['editorial photography','candid photography'],
    lighting:  ['studio softbox lighting','dramatic side lighting','neon signs at night'],
    emphasis:  'Cosplay or costume fantasy. Specific costume — anime, superhero, fantasy character. Describe costume and its explicit removal or exposure.',
  },

  tattoos: {
    label: 'Tattoos — heavily tattooed, inked, alt aesthetic',
    subjects:  ['heavily tattooed woman','tattooed woman in her 20s','inked woman in her 30s'],
    settings:  ['studio','bedroom','urban alley','tattoo shop'],
    clothing:  ['fully nude showing tattoos','topless showing tattoo coverage','in lingerie emphasizing tattoos'],
    styles:    ['editorial photography','artistic nude','candid photography'],
    lighting:  ['dramatic side lighting','studio softbox lighting','neon signs at night'],
    emphasis:  'Heavily tattooed subject. Ink coverage prominent. Describe tattoos as visual element. Alt, edgy aesthetic. Explicit nudity.',
  },

  // ── Demographics / Ethnicity ──────────────────────────────────────────────

  ebony: {
    label: 'Ebony — Black woman, explicit, confident',
    subjects:  ['Black woman in her 20s','Black woman in her 30s','two Black women'],
    settings:  ['bedroom','studio','hotel room','outdoor location'],
    clothing:  ['fully nude','in lingerie','topless','partially undressed'],
    styles:    ['editorial photography','intimate photography','candid photography'],
    lighting:  ['natural window light','golden hour sunlight','studio softbox lighting'],
    emphasis:  'Black woman. Explicitly nude or sexual. Celebrate melanin, curves. Confident, explicit, real.',
  },

  latina: {
    label: 'Latina — Latin woman, passionate, explicit',
    subjects:  ['Latina woman in her 20s','Latina woman in her 30s','two Latina women'],
    settings:  ['bedroom','beach','outdoor location','hotel room','studio'],
    clothing:  ['fully nude','in lingerie','topless','partially undressed'],
    styles:    ['candid photography','editorial photography','lifestyle photography'],
    lighting:  ['golden hour sunlight','natural window light','candlelight'],
    emphasis:  'Latina woman. Passionate, sensual. Explicit nudity or sex. Warm skin tones, curves. Describe explicitly.',
  },

  asian: {
    label: 'Asian — Asian woman, explicit, diverse aesthetic',
    subjects:  ['Asian woman in her 20s','Asian woman in her 30s','two Asian women'],
    settings:  ['bedroom','studio','hotel room','urban setting'],
    clothing:  ['fully nude','in lingerie','in kimono being undressed','topless','partially undressed'],
    styles:    ['editorial photography','candid photography','intimate photography'],
    lighting:  ['natural window light','studio softbox lighting','neon signs at night'],
    emphasis:  'Asian woman. Explicit nudity or sex. Diverse aesthetic. Describe explicitly with visual detail.',
  },

  interracial: {
    label: 'Interracial — mixed couple, explicit sex',
    subjects:  ['interracial couple — Black man and white woman','interracial couple — white man and Black woman','interracial couple'],
    settings:  ['bedroom','hotel room','studio','living room'],
    clothing:  ['fully nude mid-sex'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Explicit interracial sex. Contrast of skin tones visually prominent. Describe positions and acts graphically.',
  },

  // ── LGBTQ+ ────────────────────────────────────────────────────────────────

  trans: {
    label: 'Trans — trans woman, explicit, nude',
    subjects:  ['trans woman in her 20s','trans woman in her 30s'],
    settings:  ['bedroom','studio','hotel room'],
    clothing:  ['fully nude','in lingerie','topless','partially undressed'],
    styles:    ['editorial photography','intimate photography','candid photography'],
    lighting:  ['natural window light','studio softbox lighting','candlelight'],
    emphasis:  'Trans woman subject. Explicit nudity. Describe body with full explicit detail including pre-op anatomy if relevant.',
  },

  bisexual: {
    label: 'Bisexual — FFM, all three engaged, explicit',
    subjects:  ['two women and a man all engaged'],
    settings:  ['bedroom','hotel room','studio'],
    clothing:  ['fully nude mid-sex'],
    styles:    ['intimate photography','candid photography'],
    lighting:  ['natural window light','candlelight','studio softbox lighting'],
    emphasis:  'Bisexual FFM scene. All three actively engaged. Describe same-sex and opposite-sex acts happening simultaneously. Explicit.',
  },

  // ── Speciality ────────────────────────────────────────────────────────────

  freeuse: {
    label: 'Free Use — casual sex, used without stopping activity',
    subjects:  ['man and woman','woman being used while doing chores'],
    settings:  ['kitchen','living room','office','home'],
    clothing:  ['woman in casual clothes being used','nude from waist down while cooking','partially undressed mid-task'],
    styles:    ['candid photography','documentary style','lifestyle photography'],
    lighting:  ['natural window light','studio softbox lighting'],
    emphasis:  'Free use fantasy. Woman used casually during normal activities — cooking, working, watching TV. Describe the mundane activity and explicit sexual act happening simultaneously.',
  },

  bukakke: {
    label: 'Bukakke — multiple men, group finish on woman',
    subjects:  ['woman surrounded by multiple men'],
    settings:  ['studio','bedroom','hotel room'],
    clothing:  ['woman nude kneeling'],
    styles:    ['candid photography','documentary style'],
    lighting:  ['studio softbox lighting','natural window light'],
    emphasis:  'Bukakke scene. Multiple men finishing on a woman. Describe the act, the woman\'s expression, and aftermath explicitly.',
  },

};
