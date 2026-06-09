const pool = require('./index');
const { normalizeAuditStatus } = require('../lib/legal-audit-rules');

function normalizeSeverity(value) {
  return ['low', 'medium', 'high', 'critical'].includes(value) ? value : 'medium';
}

async function createLegalAuditReview(input) {
  const result = await pool.query(
    `INSERT INTO legal_audit_reviews
       (source_record_type, source_record_id, account_id, risk_area, severity, status,
        title, summary, recommended_action, audit_level, audit_model,
        requires_admin_approval, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (source_record_type, source_record_id, risk_area) DO UPDATE SET
       severity = EXCLUDED.severity,
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       recommended_action = EXCLUDED.recommended_action,
       audit_level = EXCLUDED.audit_level,
       audit_model = EXCLUDED.audit_model,
       requires_admin_approval = EXCLUDED.requires_admin_approval,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING *`,
    [
      input.sourceRecordType,
      input.sourceRecordId || null,
      input.accountId || null,
      input.riskArea,
      normalizeSeverity(input.severity),
      normalizeAuditStatus(input.status),
      input.title,
      input.summary || null,
      input.recommendedAction || null,
      input.auditLevel || 'legal_audit_ai',
      input.auditModel || null,
      input.requiresAdminApproval !== false,
      JSON.stringify(input.metadata || {}),
    ]
  );
  return result.rows[0];
}

async function listLegalAuditReviews({ status = 'all', limit = 100 } = {}) {
  const where = status && status !== 'all' ? 'WHERE l.status = $2' : '';
  const params = status && status !== 'all' ? [limit, normalizeAuditStatus(status)] : [limit];
  const result = await pool.query(
    `SELECT l.*, a.business_name, a.email AS account_email
     FROM legal_audit_reviews l
     LEFT JOIN client_accounts a ON a.id = l.account_id
     ${where}
     ORDER BY
       CASE l.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       l.created_at DESC
     LIMIT $1`,
    params
  );
  return result.rows;
}

async function getLegalAuditReviewById(id) {
  const result = await pool.query(
    `SELECT l.*, a.business_name, a.email AS account_email
     FROM legal_audit_reviews l
     LEFT JOIN client_accounts a ON a.id = l.account_id
     WHERE l.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getLegalAuditReviewBySource({ sourceRecordType, sourceRecordId, riskArea }) {
  const result = await pool.query(
    `SELECT * FROM legal_audit_reviews
     WHERE source_record_type = $1
       AND source_record_id = $2
       AND risk_area = $3
     LIMIT 1`,
    [sourceRecordType, sourceRecordId || null, riskArea]
  );
  return result.rows[0] || null;
}

async function updateLegalAuditReviewStatus({ id, status, resolutionNote, approvedBy }) {
  const normalizedStatus = normalizeAuditStatus(status);
  const result = await pool.query(
    `UPDATE legal_audit_reviews
     SET status = $2,
         resolution_note = COALESCE($3, resolution_note),
         approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE approved_at END,
         resolved_at = CASE WHEN $2 IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END,
         metadata = jsonb_set(metadata, '{last_reviewed_by}', to_jsonb($4::text), true),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, normalizedStatus, resolutionNote || null, approvedBy || 'admin']
  );
  return result.rows[0] || null;
}

module.exports = {
  createLegalAuditReview,
  getLegalAuditReviewById,
  getLegalAuditReviewBySource,
  listLegalAuditReviews,
  updateLegalAuditReviewStatus,
};
