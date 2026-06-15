const pool = require('./index');

async function recordSmsWebhookEvent({
  messageSid,
  fromPhone,
  toPhone,
  body,
  eventType,
  direction,
  messageStatus,
  errorCode,
  errorMessage,
  rawPayload,
}) {
  const result = await pool.query(
    `INSERT INTO sms_webhook_events
       (message_sid, from_phone, to_phone, body, direction, event_type,
        message_status, error_code, error_message, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (message_sid) DO UPDATE SET
       from_phone = COALESCE(EXCLUDED.from_phone, sms_webhook_events.from_phone),
       to_phone = COALESCE(EXCLUDED.to_phone, sms_webhook_events.to_phone),
       body = EXCLUDED.body,
       direction = EXCLUDED.direction,
       event_type = EXCLUDED.event_type,
       message_status = EXCLUDED.message_status,
       error_code = EXCLUDED.error_code,
       error_message = EXCLUDED.error_message,
       raw_payload = EXCLUDED.raw_payload
     RETURNING *`,
    [
      messageSid || null,
      fromPhone || null,
      toPhone || null,
      body || null,
      direction || 'inbound',
      eventType || 'message',
      messageStatus || null,
      errorCode || null,
      errorMessage || null,
      JSON.stringify(rawPayload || {}),
    ]
  );
  return result.rows[0];
}

module.exports = { recordSmsWebhookEvent };
