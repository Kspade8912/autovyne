module.exports = {
  name: 'twilio_status_callbacks',
  up: async (client) => {
    await client.query(`
      ALTER TABLE sms_webhook_events
        ADD COLUMN IF NOT EXISTS message_status TEXT,
        ADD COLUMN IF NOT EXISTS error_code TEXT,
        ADD COLUMN IF NOT EXISTS error_message TEXT;

      CREATE INDEX IF NOT EXISTS sms_webhook_events_status_created_idx
        ON sms_webhook_events (message_status, created_at DESC);
    `);
  },
};
