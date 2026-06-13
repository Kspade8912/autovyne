module.exports = {
  name: 'lead_outreach_pipeline',
  up: async (client) => {
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS contact_name TEXT,
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'site',
        ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'new',
        ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS owner TEXT,
        ADD COLUMN IF NOT EXISTS personalization_note TEXT,
        ADD COLUMN IF NOT EXISTS outreach_notes TEXT,
        ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS leads_stage_created_at_idx
        ON leads (stage, created_at DESC);
      CREATE INDEX IF NOT EXISTS leads_next_action_at_idx
        ON leads (next_action_at);
      CREATE INDEX IF NOT EXISTS leads_do_not_contact_idx
        ON leads (do_not_contact);
    `);
  },
};
