const pool = require('./index');

async function recordSmsConsent({
  phone,
  consented,
  formSource,
  sourceRecordType,
  sourceRecordId,
  ipAddress,
  userAgent,
  consentText,
}) {
  const result = await pool.query(
    `INSERT INTO sms_consent_records
       (phone, consented, consented_at, form_source, source_record_type,
        source_record_id, ip_address, user_agent, consent_text)
     VALUES ($1,$2,CASE WHEN $2 THEN NOW() ELSE NULL END,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      phone || null,
      Boolean(consented),
      formSource,
      sourceRecordType || null,
      sourceRecordId || null,
      ipAddress || null,
      userAgent || null,
      consentText,
    ]
  );
  return result.rows[0];
}

async function listSmsConsentRecords({ limit = 250 } = {}) {
  const result = await pool.query(
    'SELECT * FROM sms_consent_records ORDER BY recorded_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
}

module.exports = { recordSmsConsent, listSmsConsentRecords };
