process.env.NODE_ENV = 'test';
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const db = require('../db');

test('workflows table exists', () => {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'").get();
  assert.strictEqual(row.name, 'workflows');
});

test('prompts table exists', () => {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prompts'").get();
  assert.strictEqual(row.name, 'prompts');
});

test('insert and retrieve workflow', () => {
  const result = db.prepare("INSERT INTO workflows (name) VALUES (?)").run('Test Workflow');
  assert.ok(result.lastInsertRowid > 0);
  const row = db.prepare("SELECT name FROM workflows WHERE id = ?").get(result.lastInsertRowid);
  assert.strictEqual(row.name, 'Test Workflow');
});

test('insert and retrieve prompt', () => {
  const result = db.prepare("INSERT INTO prompts (name, positive) VALUES (?, ?)").run('Test Prompt', 'a cat');
  assert.ok(result.lastInsertRowid > 0);
  const row = db.prepare("SELECT name, positive FROM prompts WHERE id = ?").get(result.lastInsertRowid);
  assert.strictEqual(row.name, 'Test Prompt');
  assert.strictEqual(row.positive, 'a cat');
});

let app;
test('before routes — load app', () => {
  app = require('../server');
});

test('GET /prompts returns 200', async () => {
  const res = await request(app).get('/prompts');
  assert.strictEqual(res.status, 200);
});

test('GET /prompts/workflows returns 200', async () => {
  const res = await request(app).get('/prompts/workflows');
  assert.strictEqual(res.status, 200);
});

test('GET /prompts/9999 returns 404', async () => {
  const res = await request(app).get('/prompts/9999');
  assert.strictEqual(res.status, 404);
});

after(() => {
  db.close();
  const fs = require('fs');
  const path = require('path');
  const testDb = path.join(__dirname, '../test.db');
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});
