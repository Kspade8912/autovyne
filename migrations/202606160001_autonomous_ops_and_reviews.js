module.exports = {
  name: 'autonomous_ops_and_reviews',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_reviews (
        id BIGSERIAL PRIMARY KEY,
        account_id BIGINT REFERENCES client_accounts(id) ON DELETE SET NULL,
        business_name TEXT NOT NULL,
        reviewer_name TEXT,
        reviewer_role TEXT,
        quote TEXT NOT NULL,
        rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
        outcome_summary TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        source TEXT NOT NULL DEFAULT 'admin',
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS autonomous_ops_reports (
        id BIGSERIAL PRIMARY KEY,
        report_type TEXT NOT NULL DEFAULT 'daily',
        status TEXT NOT NULL DEFAULT 'generated',
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
        manual_support JSONB NOT NULL DEFAULT '[]'::jsonb,
        cold_calling_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
        audit_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
        metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        ai_narrative TEXT,
        generated_by TEXT NOT NULL DEFAULT 'autovyne_ops_ai',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS customer_reviews_status_created_idx
        ON customer_reviews (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS customer_reviews_account_idx
        ON customer_reviews (account_id);
      CREATE INDEX IF NOT EXISTS autonomous_ops_reports_created_idx
        ON autonomous_ops_reports (created_at DESC);

      ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
      ALTER TABLE autonomous_ops_reports ENABLE ROW LEVEL SECURITY;
    `);
  },
};
