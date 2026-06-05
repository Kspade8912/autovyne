/**
 * db/analytics.js
 * Owns: analytics event query functions.
 * Does NOT own: the Pool (db/index.js), route logic (routes/analytics.js).
 */
const pool = require('./index');

async function logEvent({ page, eventType, metadata, ipHash, userAgent, referrer }) {
  await pool.query(
    `INSERT INTO page_views (page, event_type, metadata, ip_hash, user_agent, referrer)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [page, eventType, JSON.stringify(metadata || {}), ipHash || null, userAgent || null, referrer || null]
  );
}

async function getDailyPageViews(days = 30) {
  const result = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS views
     FROM page_views
     WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );
  return result.rows;
}

async function getDailyFormSubmissions(days = 30) {
  const result = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS submissions
     FROM page_views
     WHERE event_type = 'submit' AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );
  return result.rows;
}

async function getTopReferrers(days = 30, limit = 10) {
  const result = await pool.query(
    `SELECT referrer, COUNT(*) AS count
     FROM page_views
     WHERE referrer IS NOT NULL AND referrer != '' AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
     GROUP BY referrer
     ORDER BY count DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getTopPages(days = 30, limit = 20) {
  const result = await pool.query(
    `SELECT page, COUNT(*) AS views
     FROM page_views
     WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
     GROUP BY page
     ORDER BY views DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getTotalStats(days = 30) {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE event_type = 'view') AS total_page_views,
       COUNT(*) FILTER (WHERE event_type = 'submit') AS total_form_submissions,
       COUNT(*) FILTER (WHERE event_type = 'click') AS total_cta_clicks,
       COUNT(*) FILTER (WHERE event_type = 'demo_interaction') AS total_demo_interactions
     FROM page_views
     WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'`
  );
  return result.rows[0];
}

module.exports = {
  logEvent,
  getDailyPageViews,
  getDailyFormSubmissions,
  getTopReferrers,
  getTopPages,
  getTotalStats,
};