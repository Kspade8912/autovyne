const pool = require('./index');

async function recordSmsWebhookEvent({
  messageSid,
  fromPhone,
  toPhone,
  body,
  eventType,
  rawPayload,
}) {
  const result = await pool.query(
    `INSERT INTO sms_webhook_events
       (message_sid, from_phone, to_phone, body, event_type, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (message_sid) DO UPDATE SET
       body = EXCLUDED.body,
       event_type = EXCLUDED.event_type,
       raw_payload = EXCLUDED.raw_payload
     RETURNING *`,
    [
      messageSid || null,
      fromPhone || null,
      toPhone || null,
      body || null,
      eventType || 'message',
      JSON.stringify(rawPayload || {}),
    ]
  );
  return result.rows[0];
}

module.exports = { recordSmsWebhookEvent };
