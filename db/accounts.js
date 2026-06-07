const crypto = require('crypto');
const pool = require('./index');

function portalSalt() {
  return process.env.PORTAL_CODE_SALT || process.env.COOKIE_SECRET || 'autovyne-portal-v1';
}

function hashAccessCode(code) {
  return crypto.createHash('sha256').update(`${portalSalt()}:${String(code || '').trim()}`).digest('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function defaultServices(input = {}) {
  return {
    ai_calling: Boolean(input.ai_calling),
    sms_followup: Boolean(input.sms_followup),
    crm_sync: Boolean(input.crm_sync),
    n8n_workflows: Boolean(input.n8n_workflows),
    openai_qualification: Boolean(input.openai_qualification),
  };
}

function defaultMetrics(input = {}) {
  return {
    calls_handled: Number(input.calls_handled || 0),
    sms_sent: Number(input.sms_sent || 0),
    crm_leads_synced: Number(input.crm_leads_synced || 0),
    missed_calls_recovered: Number(input.missed_calls_recovered || 0),
    estimated_revenue_recovered: Number(input.estimated_revenue_recovered || 0),
  };
}

function normalizeBillingMethod(value) {
  return value === 'manual' ? 'manual' : 'automatic';
}

async function createOrUpdateAccount({
  businessName,
  contactName,
  email,
  phone,
  status,
  plan,
  billingMethod,
  accessCode,
  services,
  metrics,
  notes,
}) {
  const normalizedEmail = normalizeEmail(email);
  const serviceJson = defaultServices(services);
  const metricJson = defaultMetrics(metrics);
  const codeHash = hashAccessCode(accessCode);

  const result = await pool.query(
    `INSERT INTO client_accounts
       (business_name, contact_name, email, phone, status, plan, billing_method, access_code_hash, services, metrics, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (email) DO UPDATE SET
       business_name = EXCLUDED.business_name,
       contact_name = EXCLUDED.contact_name,
       phone = EXCLUDED.phone,
       status = EXCLUDED.status,
       plan = EXCLUDED.plan,
       billing_method = EXCLUDED.billing_method,
       access_code_hash = EXCLUDED.access_code_hash,
       services = EXCLUDED.services,
       metrics = EXCLUDED.metrics,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING *`,
    [
      businessName,
      contactName || null,
      normalizedEmail,
      phone || null,
      status || 'setup',
      plan || 'starter',
      normalizeBillingMethod(billingMethod),
      codeHash,
      JSON.stringify(serviceJson),
      JSON.stringify(metricJson),
      notes || null,
    ]
  );
  return result.rows[0];
}

async function updateAccountById({
  id,
  businessName,
  contactName,
  email,
  phone,
  status,
  plan,
  billingMethod,
  accessCode,
  services,
  metrics,
  notes,
}) {
  const normalizedEmail = normalizeEmail(email);
  const serviceJson = defaultServices(services);
  const metricJson = defaultMetrics(metrics);
  const hasNewAccessCode = String(accessCode || '').trim().length > 0;

  const result = await pool.query(
    `UPDATE client_accounts SET
       business_name = $2,
       contact_name = $3,
       email = $4,
       phone = $5,
       status = $6,
       plan = $7,
       billing_method = $8,
       access_code_hash = CASE WHEN $9::BOOLEAN THEN $10 ELSE access_code_hash END,
       services = $11,
       metrics = $12,
       notes = $13,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      businessName,
      contactName || null,
      normalizedEmail,
      phone || null,
      status || 'setup',
      plan || 'starter',
      normalizeBillingMethod(billingMethod),
      hasNewAccessCode,
      hasNewAccessCode ? hashAccessCode(accessCode) : null,
      JSON.stringify(serviceJson),
      JSON.stringify(metricJson),
      notes || null,
    ]
  );
  return result.rows[0] || null;
}

async function createOrUpdateAccountWithHash({
  businessName,
  contactName,
  email,
  phone,
  status,
  plan,
  billingMethod,
  accessCodeHash,
  services,
  metrics,
  notes,
  stripeCustomerId,
  stripeCheckoutSessionId,
  stripeSubscriptionId,
  paidAt,
  activatedAt,
}) {
  const normalizedEmail = normalizeEmail(email);
  const serviceJson = defaultServices(services);
  const metricJson = defaultMetrics(metrics);

  const result = await pool.query(
    `INSERT INTO client_accounts
       (business_name, contact_name, email, phone, status, plan, billing_method, access_code_hash,
        services, metrics, notes, stripe_customer_id, stripe_checkout_session_id,
        stripe_subscription_id, paid_at, activated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (email) DO UPDATE SET
       business_name = EXCLUDED.business_name,
       contact_name = EXCLUDED.contact_name,
       phone = EXCLUDED.phone,
       status = EXCLUDED.status,
       plan = EXCLUDED.plan,
       billing_method = EXCLUDED.billing_method,
       access_code_hash = EXCLUDED.access_code_hash,
       services = EXCLUDED.services,
       metrics = EXCLUDED.metrics,
       notes = EXCLUDED.notes,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       paid_at = EXCLUDED.paid_at,
       activated_at = EXCLUDED.activated_at,
       updated_at = NOW()
     RETURNING *`,
    [
      businessName,
      contactName || null,
      normalizedEmail,
      phone || null,
      status || 'active',
      plan || 'starter',
      normalizeBillingMethod(billingMethod),
      accessCodeHash,
      JSON.stringify(serviceJson),
      JSON.stringify(metricJson),
      notes || null,
      stripeCustomerId || null,
      stripeCheckoutSessionId || null,
      stripeSubscriptionId || null,
      paidAt || null,
      activatedAt || null,
    ]
  );
  return result.rows[0];
}

async function getAccountByLogin(email, accessCode) {
  const result = await pool.query(
    'SELECT * FROM client_accounts WHERE email = $1 AND access_code_hash = $2 LIMIT 1',
    [normalizeEmail(email), hashAccessCode(accessCode)]
  );
  return result.rows[0] || null;
}

async function getAccountById(id) {
  const result = await pool.query('SELECT * FROM client_accounts WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function listAccounts({ limit = 250 } = {}) {
  const result = await pool.query(
    `SELECT a.*,
       (SELECT COUNT(*) FROM client_activity_events e WHERE e.account_id = a.id) AS event_count,
       (SELECT MAX(created_at) FROM client_activity_events e WHERE e.account_id = a.id) AS last_event_at
     FROM client_accounts a
     ORDER BY a.updated_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function recordAccountEvent({
  accountId,
  eventType,
  title,
  detail,
  metadata,
  visibleToClient = true,
}) {
  const result = await pool.query(
    `INSERT INTO client_activity_events
       (account_id, event_type, title, detail, metadata, visible_to_client)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      accountId,
      eventType || 'update',
      title,
      detail || null,
      JSON.stringify(metadata || {}),
      Boolean(visibleToClient),
    ]
  );
  return result.rows[0];
}

async function listAccountEvents(accountId, { visibleOnly = false, limit = 50 } = {}) {
  const filter = visibleOnly ? 'AND visible_to_client = TRUE' : '';
  const result = await pool.query(
    `SELECT * FROM client_activity_events
     WHERE account_id = $1 ${filter}
     ORDER BY created_at DESC
     LIMIT $2`,
    [accountId, limit]
  );
  return result.rows;
}

async function getAdminSnapshot() {
  const [leads, submissions, questions, consents] = await Promise.all([
    pool.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 20'),
    pool.query('SELECT * FROM intake_submissions ORDER BY created_at DESC LIMIT 20'),
    pool.query('SELECT * FROM questions ORDER BY created_at DESC LIMIT 20'),
    pool.query('SELECT * FROM sms_consent_records ORDER BY recorded_at DESC LIMIT 20'),
  ]);

  return {
    leads: leads.rows,
    submissions: submissions.rows,
    questions: questions.rows,
    consents: consents.rows,
  };
}

module.exports = {
  createOrUpdateAccount,
  createOrUpdateAccountWithHash,
  defaultMetrics,
  defaultServices,
  getAccountById,
  getAccountByLogin,
  getAdminSnapshot,
  hashAccessCode,
  listAccountEvents,
  listAccounts,
  normalizeBillingMethod,
  recordAccountEvent,
  updateAccountById,
};
