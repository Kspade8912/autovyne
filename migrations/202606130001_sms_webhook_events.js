module.exports = {
  name: 'sms_webhook_events',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_webhook_events (
        id BIGSERIAL PRIMARY KEY,
        message_sid TEXT UNIQUE,
        from_phone TEXT,
        to_phone TEXT,
        body TEXT,
        direction TEXT NOT NULL DEFAULT 'inbound',
        event_type TEXT NOT NULL DEFAULT 'message',
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS sms_webhook_events_from_created_idx
        ON sms_webhook_events (from_phone, created_at DESC);
      CREATE INDEX IF NOT EXISTS sms_webhook_events_type_created_idx
        ON sms_webhook_events (event_type, created_at DESC);

      ALTER TABLE sms_webhook_events ENABLE ROW LEVEL SECURITY;
    `);
  },
};
