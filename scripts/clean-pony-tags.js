#!/usr/bin/env node
// Strip Pony-specific e621 tags from prompts where base_model is not Pony
// Usage: node scripts/clean-pony-tags.js [--dry-run]

const db = require('../db');

const DRY_RUN = process.argv.includes('--dry-run');

const PONY_PATTERN = /\b(score_\d+(_up)?|source_(anime|furry|cartoon|pony|real)|rating_(safe|explicit|questionable|e))\b,?\s*/gi;

function stripPonyTags(text) {
  if (!text) return text;
  return text
    .replace(PONY_PATTERN, '')
    .replace(/,\s*,/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
}

const rows = db.prepare(`
  SELECT id, base_model, positive, negative
  FROM prompts
  WHERE base_model IS NOT 'Pony' AND (positive LIKE '%score_%' OR positive LIKE '%source_%' OR positive LIKE '%rating_%')
`).all();

console.log(`Found ${rows.length} prompts to clean${DRY_RUN ? ' (dry run)' : ''}...`);

const update = db.prepare('UPDATE prompts SET positive=?, negative=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');

const cleanAll = db.transaction((rows) => {
  let count = 0;
  for (const row of rows) {
    const cleanPos = stripPonyTags(row.positive);
    const cleanNeg = stripPonyTags(row.negative);
    if (cleanPos !== row.positive || cleanNeg !== row.negative) {
      if (!DRY_RUN) update.run(cleanPos, cleanNeg, row.id);
      count++;
    }
  }
  return count;
});

const changed = cleanAll(rows);
console.log(`${DRY_RUN ? 'Would update' : 'Updated'} ${changed} prompts.`);
