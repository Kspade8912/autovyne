const { Router } = require('express');
const pool = require('../db');
const { getConfigurationStatus } = require('../services/integrations');
const { requireAdminApiAccess } = require('../lib/admin-api-auth');

const router = Router();

router.get('/status', requireAdminApiAccess, async (req, res) => {
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
