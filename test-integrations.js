const assert = require('assert');

process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.OPENAI_MODEL = 'gpt-5.4-mini';
process.env.HUBSPOT_ACCESS_TOKEN = 'test-hubspot-token';
process.env.N8N_WEBHOOK_URL = 'https://n8n.example/webhook/autovyne';
process.env.N8N_WEBHOOK_SECRET = 'test-n8n-secret';

const requests = [];
global.fetch = async (url, options) => {
  requests.push({ url, options });

  let body = { ok: true };
  if (url.includes('api.openai.com')) {
    body = {
      output: [{
        content: [{
          type: 'output_text',
          text: '{"priority":"high","pain_summary":"Missed calls","recommended_next_action":"Call","call_opener":"Quick question"}',
        }],
      }],
    };
  }
  if (url.includes('hubapi.com')) {
    body = { results: [{ id: 'hubspot-contact-1' }] };
  }

  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
};

const openai = require('./services/openai');
const hubspot = require('./services/hubspot');
const n8n = require('./services/n8n');

const lead = {
  id: 42,
  email: 'owner@example.com',
  business_name: 'Example HVAC',
  industry: 'hvac',
  website_url: 'https://example.com',
  monthly_call_volume: 100,
  miss_rate_pct: 30,
  estimated_missed_leads: 30,
  estimated_monthly_loss: 12000,
};

(async () => {
  const qualification = await openai.qualifyLead(lead);
  assert.equal(qualification.priority, 'high');

  const contact = await hubspot.upsertLead(lead);
  assert.equal(contact.id, 'hubspot-contact-1');

  await n8n.sendLeadEvent(lead, qualification);

  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
  assert.ok(requests[1].url.includes('/crm/v3/objects/contacts/batch/upsert'));
  assert.equal(requests[2].options.headers['X-Autovyne-Secret'], 'test-n8n-secret');

  const hubspotBody = JSON.parse(requests[1].options.body);
  assert.equal(hubspotBody.inputs[0].idProperty, 'email');
  assert.equal(hubspotBody.inputs[0].properties.company, 'Example HVAC');

  console.log('Integration adapter smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
