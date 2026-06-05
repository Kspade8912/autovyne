const { Router } = require('express');
const pool = require('../db');
const { getConfigurationStatus } = require('../services/integrations');

const router = Router();

router.get('/status', async (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  const token = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';

  if (!adminKey || token !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const status = getConfigurationStatus();
  try {
    await pool.query('SELECT 1');
    status.supabase.reachable = true;
  } catch (error) {
    status.supabase.reachable = false;
    status.supabase.error = error.message;
  }

  res.json(status);
});

module.exports = router;
