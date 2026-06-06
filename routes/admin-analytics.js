/**
 * routes/admin-analytics.js
 * Owns: GET /admin/analytics (dashboard page), POST /admin/analytics (login form handler).
 * Does NOT own: analytics data queries (db/analytics.js), analytics event logging (routes/analytics.js).
 */
const { Router } = require('express');
const { getDailyPageViews, getDailyFormSubmissions, getTopReferrers, getTopPages, getTotalStats } = require('../db/analytics');
const { hasAdminSession, setAdminSession } = require('../lib/admin-auth');

const router = Router();

// GET /admin/analytics — show dashboard (checks session cookie for auth)
router.get('/', async (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return res.status(403).send('<h1>Forbidden</h1>');

  // Check auth via signed cookie
  const token = req.signedCookies?.analytics_auth;
  const days = Math.min(parseInt(req.query.days) || 30, 90);

  if (hasAdminSession(req) || token === adminKey) {
    try {
      const [pageViews, formSubmissions, topReferrers, topPages, totals] = await Promise.all([
        getDailyPageViews(days),
        getDailyFormSubmissions(days),
        getTopReferrers(days),
        getTopPages(days),
        getTotalStats(days),
      ]);
      return res.render('admin-analytics', {
        authorized: true,
        error: null,
        pageViews,
        formSubmissions,
        topReferrers,
        topPages,
        totals: totals || {},
        days,
      });
    } catch (err) {
      console.error('[admin-analytics] load error:', err.message);
      return res.render('admin-analytics', {
        authorized: true,
        error: 'Failed to load analytics data.',
        pageViews: [],
        formSubmissions: [],
        topReferrers: [],
        topPages: [],
        totals: {},
        days,
      });
    }
  }

  res.render('admin-analytics', { authorized: false, error: null, days });
});

// POST /admin/analytics — verify admin key and set signed cookie
router.post('/', (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return res.status(403).send('<h1>Forbidden</h1>');

  const { key } = req.body;
  if (key === adminKey) {
    // Set a 24-hour signed cookie
    res.cookie('analytics_auth', adminKey, {
      httpOnly: true,
      signed: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    setAdminSession(res);
    return res.redirect('/admin/analytics');
  }

  res.render('admin-analytics', { authorized: false, error: 'Invalid key', days: 30 });
});

module.exports = router;
