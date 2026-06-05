// routes/roi.js — Redirects /roi to the unified /demo page
const { Router } = require('express');
const router = Router();

// Redirect all /roi requests to /demo
router.get('/', (_req, res) => {
  res.redirect(301, '/demo');
});

module.exports = router;