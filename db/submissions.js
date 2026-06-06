/**
 * db/submissions.js
 * Owns: all queries against the intake_submissions table.
 * Does NOT own: Pool construction (db/index.js), HTTP request handling (routes/).
 */
const pool = require('./index');

/**
 * Persist a new intake submission and return the full row.
 * Revenue estimate: rough calc — recovered leads × avg deal value ($400).
 */
async function createSubmission({
  businessName,
  industry,
  phone,
  currentTools,
  monthlyCalls,
  missedCallsPct,
  smsConsent,
}) {
  const missedLeads = Math.round((monthlyCalls * missedCallsPct) / 100);
  // Recover ~35% of missed leads; avg local biz deal ~$400
  const recoveredLeads = Math.round(missedLeads * 0.35);
  const revenueRecovered = recoveredLeads * 400;

  const result = await pool.query(
    `INSERT INTO intake_submissions
       (business_name, industry, phone, current_tools,
        monthly_calls, missed_calls_pct,
        estimated_recovery_leads, estimated_revenue_recovered,
        sms_consent, sms_consent_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9 THEN NOW() ELSE NULL END)
     RETURNING *`,
    [
      businessName,
      industry,
      phone || null,
      currentTools || null,
      monthlyCalls,
      missedCallsPct,
      recoveredLeads,
      revenueRecovered,
      Boolean(smsConsent),
    ]
  );
  return result.rows[0];
}

/** Fetch a single submission by ID for the results page. */
async function getSubmissionById(id) {
  const result = await pool.query(
    'SELECT * FROM intake_submissions WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { createSubmission, getSubmissionById };
