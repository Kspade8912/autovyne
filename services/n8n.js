const { fetchJson } = require('../lib/http');

function isConfigured() {
  return Boolean(process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET);
}

async function sendLeadEvent(lead, qualification) {
  if (!isConfigured()) return null;

  return fetchJson(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Autovyne-Secret': process.env.N8N_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      event: 'lead.created',
      sent_at: new Date().toISOString(),
      lead,
      sms_eligible: Boolean(lead.sms_consent && lead.phone),
      qualification,
    }),
  }, 15000);
}

async function sendQuestionEvent(question) {
  if (!isConfigured()) return null;

  const smsEligible = Boolean(question.smsConsent && question.phone);
  return fetchJson(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Autovyne-Secret': process.env.N8N_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      event: 'question.created',
      sent_at: new Date().toISOString(),
      sms_eligible: smsEligible,
      question: { ...question, phone: smsEligible ? question.phone : null },
    }),
  }, 15000);
}

module.exports = { isConfigured, sendLeadEvent, sendQuestionEvent };
