/**
 * db/leads.js
 * Owns: all queries against the leads table.
 * Does NOT own: Pool construction (db/index.js), HTTP handling (routes/).
 */
const pool = require('./index');

/**
 * Persist a new lead and return the full row.
 * Estimates: missed leads = round(volume × miss_rate / 100),
 * monthly loss = missed leads × $400 avg deal value.
 */
async function createLead({
  businessName,
  industry,
  monthlyCallVolume,
  missRatePct,
  websiteUrl,
}) {
  const missedLeads = Math.round((monthlyCallVolume * missRatePct) / 100);
  const monthlyLoss = missedLeads * 400;

  const result = await pool.query(
    `INSERT INTO leads
       (business_name, industry, monthly_call_volume, miss_rate_pct,
        website_url, estimated_missed_leads, estimated_monthly_loss)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      businessName,
      industry,
      monthlyCallVolume,
      missRatePct,
      websiteUrl || null,
      missedLeads,
      monthlyLoss,
    ]
  );
  return result.rows[0];
}

/** Fetch all leads, newest first (internal use). */
async function listLeads({ limit = 100 } = {}) {
  const result = await pool.query(
    'SELECT * FROM leads ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
}

/** Fetch a single lead by ID. */
async function getLeadById(id) {
  const result = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = { createLead, listLeads, getLeadById };