module.exports = {
  name: 'initial_supabase_schema',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id BIGSERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        industry TEXT NOT NULL,
        monthly_call_volume INTEGER NOT NULL,
        miss_rate_pct INTEGER NOT NULL,
        website_url TEXT,
        email TEXT,
        estimated_missed_leads INTEGER NOT NULL DEFAULT 0,
        estimated_monthly_loss INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS intake_submissions (
        id BIGSERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        industry TEXT NOT NULL,
        phone TEXT,
        current_tools TEXT,
        monthly_calls INTEGER NOT NULL,
        missed_calls_pct INTEGER NOT NULL,
        estimated_recovery_leads INTEGER NOT NULL DEFAULT 0,
        estimated_revenue_recovered INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS page_views (
        id BIGSERIAL PRIMARY KEY,
        page TEXT NOT NULL,
        event_type TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_hash TEXT,
        user_agent TEXT,
        referrer TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
      CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON page_views (created_at DESC);
      CREATE INDEX IF NOT EXISTS page_views_event_type_idx ON page_views (event_type);

      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
      ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
    `);
  },
};
