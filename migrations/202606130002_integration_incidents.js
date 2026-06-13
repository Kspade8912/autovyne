module.exports = {
  name: 'integration_incidents',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS integration_incidents (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        severity TEXT NOT NULL DEFAULT 'warning',
        message TEXT NOT NULL,
        context JSONB NOT NULL DEFAULT '{}'::jsonb,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS integration_incidents_created_at_idx
        ON integration_incidents (created_at DESC);
      CREATE INDEX IF NOT EXISTS integration_incidents_status_idx
        ON integration_incidents (status);
      CREATE INDEX IF NOT EXISTS integration_incidents_provider_idx
        ON integration_incidents (provider);

      ALTER TABLE integration_incidents ENABLE ROW LEVEL SECURITY;
    `);
  },
};
