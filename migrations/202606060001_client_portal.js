module.exports = {
  name: 'client_portal',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_accounts (
        id BIGSERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'setup',
        plan TEXT NOT NULL DEFAULT 'starter',
        access_code_hash TEXT NOT NULL,
        services JSONB NOT NULL DEFAULT '{}'::jsonb,
        metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS client_activity_events (
        id BIGSERIAL PRIMARY KEY,
        account_id BIGINT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL DEFAULT 'update',
        title TEXT NOT NULL,
        detail TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS client_accounts_status_idx ON client_accounts (status);
      CREATE INDEX IF NOT EXISTS client_accounts_email_idx ON client_accounts (email);
      CREATE INDEX IF NOT EXISTS client_activity_account_created_idx
        ON client_activity_events (account_id, created_at DESC);

      ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE client_activity_events ENABLE ROW LEVEL SECURITY;
    `);
  },
};
