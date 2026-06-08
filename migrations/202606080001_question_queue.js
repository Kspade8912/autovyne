module.exports = {
  name: 'question_queue',
  up: async (client) => {
    await client.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'normal';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS contact_preference TEXT NOT NULL DEFAULT 'email';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS owner_note TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS admin_reply TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

      CREATE INDEX IF NOT EXISTS questions_status_idx
        ON questions (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS questions_category_idx
        ON questions (category, created_at DESC);
    `);
  },
};
