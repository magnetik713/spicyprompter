const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('prompts/index', { prompts: [], models: [], currentModel: 'All', q: '', title: 'Prompt Library' });
});

router.get('/:id', (req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

module.exports = router;
