const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('workflows/index', { workflows: [], title: 'Workflows' });
});

module.exports = router;
