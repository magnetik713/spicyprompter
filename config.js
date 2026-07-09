const db = require('./db');

const DEFAULTS = {
  llm_base_url:      'http://localhost:11434/v1',
  llm_api_key:       'ollama',
  llm_default_model: '',
  comfyui_host:      'localhost',
  comfyui_port:      '8188',
  comfyui_workflow:  '',
  comfyui_node_id:   '',
  comfyui_model:     '',
  llm_temperature:        '1.0',
  llm_top_p:              '',
  llm_repetition_penalty: '1.1',
  llm_max_tokens:         '300',
  llm_raw_output:         'false',
};

function get(key) {
  const row = db.prepare('SELECT value FROM config WHERE key=?').get(key);
  return row ? row.value : (DEFAULTS[key] ?? null);
}

function set(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?,?)').run(key, String(value));
}

function getAll() {
  const rows = db.prepare('SELECT key, value FROM config').all();
  const result = { ...DEFAULTS };
  for (const r of rows) result[r.key] = r.value;
  return result;
}

function isPaid() {
  return get('license_status') === 'paid';
}

const VERIFY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function verifyLicense() {
  const key = get('license_key');
  if (!key) return false;
  try {
    const https = require('https');
    const params = new URLSearchParams({
      product_id: 'AylEKdF8-sFMHlSHeN03hQ==',
      license_key: key,
      increment_uses_count: 'false'
    }).toString();
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'gumroad.com',
        path: '/api/v2/licenses/verify',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(params) }
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
      });
      req.on('error', reject);
      req.write(params);
      req.end();
    });
    if (result.success) {
      set('last_license_check', String(Date.now()));
      return true;
    } else {
      set('license_status', 'free');
      set('license_key', '');
      return false;
    }
  } catch (e) {
    // network error — benefit of the doubt, don't downgrade
    return true;
  }
}

async function checkLicense() {
  if (!isPaid()) return true; // free tier, no check needed
  const last = parseInt(get('last_license_check') || '0');
  if (Date.now() - last < VERIFY_INTERVAL_MS) return true; // cached
  return verifyLicense();
}

module.exports = { get, set, getAll, isPaid, verifyLicense, checkLicense };

