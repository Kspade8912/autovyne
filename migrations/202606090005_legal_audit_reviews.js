module.exports = {
  name: 'legal_audit_reviews',
  up: async (client) => {
    await client.query(`
      ALTER TABLE client_action_requests
        ADD COLUMN IF NOT EXISTS admin_note TEXT,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

      CREATE TABLE IF NOT EXISTS legal_audit_reviews (
        id BIGSERIAL PRIMARY KEY,
        source_record_type TEXT NOT NULL,
        source_record_id BIGINT,
        account_id BIGINT REFERENCES client_accounts(id) ON DELETE SET NULL,
        risk_area TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'needs_admin_review',
        title TEXT NOT NULL,
        summary TEXT,
        recommended_action TEXT,
        audit_level TEXT NOT NULL DEFAULT 'legal_audit_ai',
        audit_model TEXT,
        requires_admin_approval BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        resolution_note TEXT,
        approved_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source_record_type, source_record_id, risk_area)
      );

      CREATE INDEX IF NOT EXISTS legal_audit_reviews_status_created_idx
        ON legal_audit_reviews (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS legal_audit_reviews_account_idx
        ON legal_audit_reviews (account_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS legal_audit_reviews_risk_idx
        ON legal_audit_reviews (risk_area, severity);

      ALTER TABLE legal_audit_reviews ENABLE ROW LEVEL SECURITY;
    `);
  },
};
