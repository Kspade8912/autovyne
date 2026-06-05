/**
 * routes/analytics.js
 * Owns: POST /api/analytics (log event), GET /api/analytics (admin dashboard data).
 * Does NOT own: DB queries (db/analytics.js), rendering (views/admin-analytics.ejs).
 */
const { Router } = require('express');
const { logEvent, getDailyPageViews, getDailyFormSubmissions, getTopReferrers, getTopPages, getTotalStats } = require('../db/analytics');
const crypto = require('crypto');

const router = Router();

// POST /api/analytics — log a client-side event (beacon, fire-and-forget)
router.post('/', async (req, res) => {
  const { page, event_type, metadata, referrer } = req.body;

  if (!page || !event_type) {
    return res.status(400).json({ error: 'page and event_type are required' });
  }

  const allowedTypes = ['view', 'submit', 'click', 'demo_interaction'];
  if (!allowedTypes.includes(event_type)) {
    return res.status(400).json({ error: 'invalid event_type' });
  }

  // Privacy-safe IP hash: SHA-256 of IP + app secret salt
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  const salt = process.env.ANALYTICS_IP_SALT || 'autovyne-v1';
  const ipHash = ip ? crypto.createHash('sha256').update(ip + salt).digest('hex') : null;

  try {
    await logEvent({
      page: String(page).slice(0, 255),
      eventType: String(event_type),
      metadata: metadata || {},
      ipHash,
      userAgent: req.headers['user-agent'] || null,
      referrer: referrer ? String(referrer).slice(0, 500) : null,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    // Log but don't fail — analytics should never break the app
    console.error('[analytics] log error:', err.message);
    res.status(201).json({ ok: true }); // still return success so client beacon doesn't retry
  }
});

// GET /api/analytics — admin dashboard data (requires ADMIN_API_KEY)
router.get('/', async (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return res.status(403).json({ error: 'Forbidden' });

  const auth = (req.headers['authorization'] || '').startsWith('Bearer ')
    ? req.headers['authorization'].slice(7) : '';
  if (auth !== adminKey) return res.status(401).json({ error: 'Unauthorized' });

  const days = Math.min(parseInt(req.query.days) || 30, 90);

  try {
    const [pageViews, formSubmissions, topReferrers, topPages, totals] = await Promise.all([
      getDailyPageViews(days),
      getDailyFormSubmissions(days),
      getTopReferrers(days),
      getTopPages(days),
      getTotalStats(days),
    ]);
    res.json({ pageViews, formSubmissions, topReferrers, topPages, totals: totals || {}, days });
  } catch (err) {
    console.error('[analytics] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;