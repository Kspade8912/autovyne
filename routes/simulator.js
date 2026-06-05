// routes/simulator.js — Redirects /simulator to the unified /demo page
const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.redirect(301, '/demo');
});

module.exports = router;