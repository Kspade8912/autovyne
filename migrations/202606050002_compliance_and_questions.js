module.exports = {
  name: 'compliance_and_questions',
  up: async (client) => {
    await client.query(`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;

      ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS sms_consent_records (
        id BIGSERIAL PRIMARY KEY,
        phone TEXT,
        consented BOOLEAN NOT NULL DEFAULT FALSE,
        consented_at TIMESTAMPTZ,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        form_source TEXT NOT NULL,
        source_record_type TEXT,
        source_record_id BIGINT,
        ip_address TEXT,
        user_agent TEXT,
        consent_text TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS questions (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        business_name TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        question TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS sms_consent_records_recorded_at_idx
        ON sms_consent_records (recorded_at DESC);
      CREATE INDEX IF NOT EXISTS sms_consent_records_phone_idx
        ON sms_consent_records (phone);
      CREATE INDEX IF NOT EXISTS questions_created_at_idx
        ON questions (created_at DESC);

      ALTER TABLE sms_consent_records ENABLE ROW LEVEL SECURITY;
      ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
    `);
  },
};
