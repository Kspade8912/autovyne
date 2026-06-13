const pool = require('./index');

const REQUIRED_TABLES = [
  'leads',
  'intake_submissions',
  'page_views',
  'sms_consent_records',
  'questions',
  'client_accounts',
  'client_activity_events',
  'client_action_requests',
  'legal_audit_reviews',
  'signup_orders',
  'sms_webhook_events',
  'integration_incidents',
];

async function checkSupabaseSchema() {
  const result = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::TEXT[])`,
    [REQUIRED_TABLES]
  );
  const found = new Set(result.rows.map(row => row.table_name));
  const tables = REQUIRED_TABLES.map(table => ({
    table,
    ready: found.has(table),
  }));

  const migrationResult = await pool.query(`
    SELECT relrowsecurity AS rls_enabled
    FROM pg_class
    WHERE oid = 'public._migrations'::regclass
  `).catch(error => ({ rows: [{ rls_enabled: false, error: error.message }] }));

  return {
    ready: tables.every(row => row.ready) && Boolean(migrationResult.rows[0]?.rls_enabled),
    tables,
    migrationsRlsEnabled: Boolean(migrationResult.rows[0]?.rls_enabled),
  };
}

module.exports = {
  REQUIRED_TABLES,
  checkSupabaseSchema,
};
