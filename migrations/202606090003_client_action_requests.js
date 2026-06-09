module.exports = {
  name: 'client_action_requests',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_action_requests (
        id BIGSERIAL PRIMARY KEY,
        account_id BIGINT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
        request_type TEXT NOT NULL,
        subject_phone TEXT,
        subject_name TEXT,
        priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'submitted',
        reason TEXT,
        compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
        requested_by_email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS client_action_requests_account_created_idx
        ON client_action_requests (account_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS client_action_requests_status_idx
        ON client_action_requests (status);
      CREATE INDEX IF NOT EXISTS client_action_requests_type_idx
        ON client_action_requests (request_type);

      ALTER TABLE client_action_requests ENABLE ROW LEVEL SECURITY;
    `);
  },
};
