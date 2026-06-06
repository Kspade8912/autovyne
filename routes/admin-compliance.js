const { Router } = require('express');
const { listSmsConsentRecords } = require('../db/compliance');
const { hasAdminSession, setAdminSession } = require('../lib/admin-auth');

const router = Router();

router.get('/', async (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return res.status(403).send('<h1>Forbidden</h1>');

  if (hasAdminSession(req) || req.signedCookies?.compliance_auth === 'authorized') {
    try {
      const records = await listSmsConsentRecords();
      return res.render('admin-compliance', { authorized: true, error: null, records });
    } catch (error) {
      console.error('[admin-compliance] load error:', error.message);
      return res.render('admin-compliance', { authorized: true, error: 'Failed to load consent records.', records: [] });
    }
  }

  res.render('admin-compliance', { authorized: false, error: null, records: [] });
});

router.post('/', (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return res.status(403).send('<h1>Forbidden</h1>');
  if (req.body.key !== adminKey) {
    return res.status(401).render('admin-compliance', { authorized: false, error: 'Invalid key', records: [] });
  }

  res.cookie('compliance_auth', 'authorized', {
    httpOnly: true,
    signed: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  setAdminSession(res);
  res.redirect('/admin/compliance');
});

module.exports = router;
