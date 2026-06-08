const { fetchJson } = require('../lib/http');

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

function authHeader() {
  const token = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  return `Basic ${token}`;
}

async function sendSms({ to, body, smsConsent, statusCallbackUrl }) {
  if (!smsConsent) {
    return { skipped: true, reason: 'sms_consent_required' };
  }
  if (!to || !body) {
    return { skipped: true, reason: 'missing_to_or_body' };
  }
  if (!isConfigured()) {
    return { skipped: true, reason: 'twilio_not_configured' };
  }

  const params = new URLSearchParams();
  params.set('To', to);
  params.set('Body', body);
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    params.set('From', process.env.TWILIO_PHONE_NUMBER);
  }
  if (statusCallbackUrl) params.set('StatusCallback', statusCallbackUrl);

  return fetchJson(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_ACCOUNT_SID)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  }, 15000);
}

module.exports = { isConfigured, sendSms };
