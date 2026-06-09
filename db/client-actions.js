const pool = require('./index');
const {
  complianceFlagsForType,
  getActionDefinition,
  normalizeActionType,
  normalizePriority,
} = require('../lib/client-action-requests');

async function createClientActionRequest({
  accountId,
  requestType,
  subjectPhone,
  subjectName,
  priority,
  reason,
  requestedByEmail,
  ipAddress,
  userAgent,
}) {
  const normalizedType = normalizeActionType(requestType);
  const definition = getActionDefinition(normalizedType);
  const normalizedPriority = normalizePriority(priority, definition.defaultPriority);

  const result = await pool.query(
    `INSERT INTO client_action_requests
       (account_id, request_type, subject_phone, subject_name, priority, reason,
        compliance_flags, requested_by_email, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      accountId,
      normalizedType,
      subjectPhone || null,
      subjectName || null,
      normalizedPriority,
      reason || null,
      JSON.stringify(complianceFlagsForType(normalizedType)),
      requestedByEmail || null,
      ipAddress || null,
      userAgent || null,
    ]
  );
  return result.rows[0];
}

async function listClientActionRequests(accountId, { limit = 20 } = {}) {
  const result = await pool.query(
    `SELECT * FROM client_action_requests
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [accountId, limit]
  );
  return result.rows;
}

async function listRecentClientActionRequests({ limit = 20 } = {}) {
  const result = await pool.query(
    `SELECT r.*, a.business_name, a.email AS account_email
     FROM client_action_requests r
     JOIN client_accounts a ON a.id = r.account_id
     ORDER BY r.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = {
  createClientActionRequest,
  listClientActionRequests,
  listRecentClientActionRequests,
};
