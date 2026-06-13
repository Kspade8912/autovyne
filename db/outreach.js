const pool = require('./index');

const STAGES = [
  'new',
  'researched',
  'approved_for_outreach',
  'contacted',
  'replied',
  'qualified',
  'booked',
  'won',
  'lost',
];

const PRIORITIES = ['low', 'medium', 'high'];

function cleanText(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeStage(value) {
  return STAGES.includes(value) ? value : 'new';
}

function normalizePriority(value) {
  return PRIORITIES.includes(value) ? value : 'medium';
}

function nullableTimestamp(value) {
  const clean = cleanText(value, 80);
  if (!clean) return null;
  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function listOutreachLeads({ limit = 250, stage = 'all' } = {}) {
  const result = await pool.query(
    `SELECT *
     FROM leads
     WHERE ($1::TEXT = 'all' OR stage = $1)
     ORDER BY
       do_not_contact ASC,
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       COALESCE(next_action_at, created_at) ASC
     LIMIT $2`,
    [stage === 'all' ? 'all' : normalizeStage(stage), limit]
  );
  return result.rows;
}

async function createOutreachLead({
  businessName,
  industry,
  websiteUrl,
  email,
  phone,
  contactName,
  source = 'manual_import',
  priority = 'medium',
  personalizationNote,
  outreachNotes,
}) {
  const duplicate = await pool.query(
    `SELECT *
     FROM leads
     WHERE
       ($1::TEXT <> '' AND lower(email) = lower($1)) OR
       ($2::TEXT <> '' AND phone = $2) OR
       lower(business_name) = lower($3)
     ORDER BY created_at DESC
     LIMIT 1`,
    [
      cleanText(email, 240),
      cleanText(phone, 80),
      cleanText(businessName, 240),
    ]
  );
  if (duplicate.rows[0]) {
    return { ...duplicate.rows[0], duplicateSkipped: true };
  }

  const result = await pool.query(
    `INSERT INTO leads
       (business_name, industry, monthly_call_volume, miss_rate_pct,
        website_url, email, phone, sms_consent,
        estimated_missed_leads, estimated_monthly_loss,
        contact_name, source, stage, priority, personalization_note, outreach_notes)
     VALUES ($1,$2,0,0,$3,$4,$5,FALSE,0,0,$6,$7,'researched',$8,$9,$10)
     RETURNING *`,
    [
      cleanText(businessName, 240),
      cleanText(industry || 'other-local-business', 120),
      cleanText(websiteUrl, 300) || null,
      cleanText(email, 240) || null,
      cleanText(phone, 80) || null,
      cleanText(contactName, 180) || null,
      cleanText(source, 120) || 'manual_import',
      normalizePriority(priority),
      cleanText(personalizationNote, 600) || null,
      cleanText(outreachNotes, 1200) || null,
    ]
  );
  return result.rows[0];
}

async function listDuplicateLeadGroups({ limit = 20 } = {}) {
  const result = await pool.query(
    `WITH normalized AS (
       SELECT
         id,
         business_name,
         email,
         phone,
         stage,
         created_at,
         CASE
           WHEN NULLIF(email, '') IS NOT NULL THEN lower(email)
           WHEN NULLIF(phone, '') IS NOT NULL THEN phone
           ELSE lower(business_name)
         END AS duplicate_key
       FROM leads
     )
     SELECT
       duplicate_key,
       COUNT(*) AS lead_count,
       MIN(created_at) AS first_seen_at,
       MAX(created_at) AS last_seen_at,
       json_agg(json_build_object(
         'id', id,
         'business_name', business_name,
         'email', email,
         'phone', phone,
         'stage', stage,
         'created_at', created_at
       ) ORDER BY created_at DESC) AS leads
     FROM normalized
     GROUP BY duplicate_key
     HAVING COUNT(*) > 1
     ORDER BY MAX(created_at) DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function updateLeadOutreach({
  id,
  stage,
  priority,
  contactName,
  owner,
  personalizationNote,
  outreachNotes,
  doNotContact,
  lastContactedAt,
  nextActionAt,
}) {
  const result = await pool.query(
    `UPDATE leads SET
       stage = $2,
       priority = $3,
       contact_name = NULLIF($4, ''),
       owner = NULLIF($5, ''),
       personalization_note = NULLIF($6, ''),
       outreach_notes = NULLIF($7, ''),
       do_not_contact = $8,
       last_contacted_at = $9,
       next_action_at = $10
     WHERE id = $1
     RETURNING *`,
    [
      id,
      normalizeStage(stage),
      normalizePriority(priority),
      cleanText(contactName, 180),
      cleanText(owner, 180),
      cleanText(personalizationNote, 600),
      cleanText(outreachNotes, 1200),
      Boolean(doNotContact),
      nullableTimestamp(lastContactedAt),
      nullableTimestamp(nextActionAt),
    ]
  );
  return result.rows[0] || null;
}

function outreachStats(leads = []) {
  return STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter(lead => lead.stage === stage).length;
    return acc;
  }, {
    total: leads.length,
    do_not_contact: leads.filter(lead => lead.do_not_contact).length,
    ready_today: leads.filter(lead => (
      !lead.do_not_contact &&
      ['approved_for_outreach', 'contacted', 'replied', 'qualified'].includes(lead.stage) &&
      (!lead.next_action_at || new Date(lead.next_action_at) <= new Date())
    )).length,
  });
}

module.exports = {
  createOutreachLead,
  listDuplicateLeadGroups,
  listOutreachLeads,
  outreachStats,
  STAGES,
  updateLeadOutreach,
};
