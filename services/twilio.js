const { fetchJson } = require('../lib/http');

function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'https://autovyne.com').replace(/\/+$/, '');
}

async function logIntegrationIncident(payload) {
  try {
    const { recordIntegrationIncident } = require('../db/integration-incidents');
    await recordIntegrationIncident(payload);
  } catch (error) {
    console.error('[twilio] incident log error:', error.message);
  }
}

function isConfigured() {
  return Boolean(isAccountConfigured() && isSenderConfigured());
}

function isAccountConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );
}

function isSenderConfigured() {
  return Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID);
}

function defaultStatusCallbackUrl() {
  return `${publicBaseUrl()}/twilio/status`;
}

function authHeader() {
  const token = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  return `Basic ${token}`;
}

function messageEndpoint() {
  return `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_ACCOUNT_SID)}/Messages.json`;
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
  params.set('StatusCallback', statusCallbackUrl || process.env.TWILIO_STATUS_CALLBACK_URL || defaultStatusCallbackUrl());

  try {
    return await fetchJson(messageEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }, 15000);
  } catch (error) {
    await logIntegrationIncident({
      provider: 'twilio',
      operation: 'sms.send',
      severity: 'warning',
      message: error.message,
      context: {
        to_present: Boolean(to),
        body_length: String(body || '').length,
        status_callback: Boolean(statusCallbackUrl),
      },
    });
    throw error;
  }
}

async function validateAccount() {
  if (!isAccountConfigured()) {
    return { ready: false, detail: 'Twilio Account SID/Auth Token are not configured.' };
  }

  try {
    const account = await fetchJson(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_ACCOUNT_SID)}.json`, {
      method: 'GET',
      headers: { Authorization: authHeader() },
    }, 15000);
    return {
      ready: Boolean(account?.sid),
      sid: account?.sid || null,
      status: account?.status || null,
      detail: account?.sid ? `Twilio account responded with status ${account.status || 'unknown'}.` : 'Twilio account response did not include an SID.',
    };
  } catch (error) {
    await logIntegrationIncident({
      provider: 'twilio',
      operation: 'account.validate',
      severity: 'warning',
      message: error.message,
      context: { account_sid_present: Boolean(process.env.TWILIO_ACCOUNT_SID) },
    });
    return { ready: false, detail: error.message };
  }
}

async function sendDiagnosticSms() {
  const to = process.env.TWILIO_TEST_TO_NUMBER;
  if (!to) {
    return {
      ready: false,
      skipped: true,
      reason: 'missing_twilio_test_to_number',
      detail: 'Set TWILIO_TEST_TO_NUMBER to your own opted-in test phone before sending a live diagnostic SMS.',
    };
  }

  if (process.env.TWILIO_TEST_SMS_CONSENT !== 'true') {
    return {
      ready: false,
      skipped: true,
      reason: 'missing_test_sms_consent_flag',
      detail: 'Set TWILIO_TEST_SMS_CONSENT=true only after the test phone owner has consented to receive the diagnostic message.',
    };
  }

  const result = await sendSms({
    to,
    body: 'Autovyne diagnostic: Twilio verified sender is connected. Reply HELP for help or STOP to opt out.',
    smsConsent: true,
  });

  return {
    ready: Boolean(result?.sid),
    sid: result?.sid || null,
    status: result?.status || null,
    detail: result?.sid
      ? `Diagnostic SMS accepted by Twilio with status ${result.status || 'queued'}.`
      : 'Twilio did not return a message SID.',
  };
}

module.exports = {
  defaultStatusCallbackUrl,
  isAccountConfigured,
  isConfigured,
  isSenderConfigured,
  sendDiagnosticSms,
  sendSms,
  validateAccount,
};
