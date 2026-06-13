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
  listOutreachLeads,
  outreachStats,
  STAGES,
  updateLeadOutreach,
};
