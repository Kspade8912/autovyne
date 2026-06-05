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
      qualification,
    }),
  }, 15000);
}

module.exports = { isConfigured, sendLeadEvent };
