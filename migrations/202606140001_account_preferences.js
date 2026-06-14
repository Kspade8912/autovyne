module.exports = {
  name: 'account_preferences',
  up: async (client) => {
    await client.query(`
      ALTER TABLE client_accounts
        ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE signup_orders
        ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

      CREATE TABLE IF NOT EXISTS portal_calendar_items (
        id BIGSERIAL PRIMARY KEY,
        account_id BIGINT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        detail TEXT,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        source TEXT NOT NULL DEFAULT 'autovyne',
        status TEXT NOT NULL DEFAULT 'planned',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS portal_calendar_account_time_idx
        ON portal_calendar_items (account_id, starts_at DESC);

      ALTER TABLE portal_calendar_items ENABLE ROW LEVEL SECURITY;
    `);
  },
};
