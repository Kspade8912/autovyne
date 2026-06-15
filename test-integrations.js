const assert = require('assert');

process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.OPENAI_MODEL = 'gpt-5.4-mini';
process.env.HUBSPOT_ACCESS_TOKEN = 'test-hubspot-token';
process.env.N8N_WEBHOOK_URL = 'https://n8n.example/webhook/autovyne';
process.env.N8N_WEBHOOK_SECRET = 'test-n8n-secret';
process.env.TWILIO_ACCOUNT_SID = 'AC_test';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';
process.env.TWILIO_PHONE_NUMBER = '+15555550000';

const requests = [];
global.fetch = async (url, options) => {
  requests.push({ url, options });

  let body = { ok: true };
  if (url.includes('api.openai.com')) {
    const requestBody = JSON.parse(options.body);
    if (String(requestBody.instructions || '').includes('Admin Copilot')) {
      body = { output: [{ content: [{ type: 'output_text', text: 'Focus on billing review, setup accounts, and SMS consent proof first.' }] }] };
    } else if (String(requestBody.instructions || '').includes('Customer Helper')) {
      body = { output: [{ content: [{ type: 'output_text', text: 'Your account is in setup. Contact Autovyne for changes.' }] }] };
    } else {
    body = {
      output: [{
        content: [{
          type: 'output_text',
          text: '{"priority":"high","pain_summary":"Missed calls","recommended_next_action":"Call","call_opener":"Quick question"}',
        }],
      }],
    };
    }
  }
  if (url.includes('hubapi.com')) {
    body = { results: [{ id: 'hubspot-contact-1' }] };
  }
  if (url.includes('api.twilio.com')) {
    body = { sid: 'SM_test', status: 'queued' };
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
const twilio = require('./services/twilio');
const { getConfigurationStatus, processNewLead } = require('./services/integrations');
const { askAdminAssistant, askCustomerAssistant } = require('./services/openai');
const { SMS_CONSENT_TEXT, hasSmsConsent } = require('./lib/sms-consent');

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
  phone: '+15555550100',
  sms_consent: true,
};

(async () => {
  const qualification = await openai.qualifyLead(lead);
  assert.equal(qualification.priority, 'high');
  const openaiBody = JSON.parse(requests[0].options.body);
  const openaiInput = JSON.parse(openaiBody.input);
  assert.equal(openaiInput.industry_profile.defining_trait, 'Urgency-first dispatcher');
  assert.equal(openaiInput.industry_profile.key, 'hvac');

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
  assert.equal(hubspotBody.inputs[0].properties.phone, '+15555550100');

  const n8nBody = JSON.parse(requests[2].options.body);
  assert.equal(n8nBody.sms_eligible, true);
  assert.equal(n8nBody.industry_profile.defining_trait, 'Urgency-first dispatcher');

  requests.length = 0;
  await processNewLead({ ...lead, sms_consent: false });
  const optedOutHubspot = JSON.parse(requests.find(request => request.url.includes('hubapi.com')).options.body);
  const optedOutN8n = JSON.parse(requests.find(request => request.url.includes('n8n.example')).options.body);
  assert.equal(optedOutHubspot.inputs[0].properties.phone, undefined);
  assert.equal(optedOutN8n.sms_eligible, false);
  assert.equal(optedOutN8n.lead.phone, null);
  assert.equal(hasSmsConsent(false), false);
  assert.ok(SMS_CONSENT_TEXT.includes('Reply STOP to opt out and HELP for help.'));

  const status = getConfigurationStatus();
  assert.equal(status.openai.configured, true);
  assert.equal(status.hubspot.configured, true);
  assert.equal(status.n8n.configured, true);
  assert.equal(typeof status.stripe.checkoutConfigured, 'boolean');
  assert.equal(typeof status.stripe.webhookConfigured, 'boolean');
  assert.equal(typeof status.twilio.accountConfigured, 'boolean');
  assert.equal(status.twilio.configured, true);
  assert.equal(status.twilio.statusCallbackUrl, null);

  requests.length = 0;
  const skippedSms = await twilio.sendSms({
    to: '+15555550100',
    body: 'Autovyne test',
    smsConsent: false,
  });
  assert.equal(skippedSms.skipped, true);
  assert.equal(skippedSms.reason, 'sms_consent_required');
  assert.equal(requests.length, 0);

  const sentSms = await twilio.sendSms({
    to: '+15555550100',
    body: 'Autovyne test',
    smsConsent: true,
  });
  assert.equal(sentSms.sid, 'SM_test');
  const twilioRequest = requests.find(request => request.url.includes('api.twilio.com'));
  assert.ok(twilioRequest);
  assert.equal(twilioRequest.options.headers.Authorization.startsWith('Basic '), true);
  const twilioBody = new URLSearchParams(twilioRequest.options.body);
  assert.equal(twilioBody.get('To'), '+15555550100');
  assert.equal(twilioBody.get('From'), '+15555550000');
  assert.equal(twilioBody.get('StatusCallback'), 'https://autovyne.com/twilio/status');

  const adminAnswer = await askAdminAssistant({
    question: 'What needs attention?',
    accounts: [{ id: 1, business_name: 'Example HVAC', industry: 'hvac', status: 'setup', services: {}, metrics: {} }],
    snapshot: { leads: [], questions: [], consents: [] },
    integrationStatus: status,
  });
  assert.ok(adminAnswer.includes('billing review'));

  const customerAnswer = await askCustomerAssistant({
    question: 'What is my status?',
    account: { business_name: 'Example HVAC', industry: 'hvac', status: 'setup', services: {}, metrics: {} },
    events: [],
  });
  assert.ok(customerAnswer.includes('setup'));

  requests.length = 0;
  await n8n.sendQuestionEvent({
    id: 7,
    email: 'owner@example.com',
    phone: '+15555550100',
    question: 'Can Autovyne follow up after missed calls?',
    smsConsent: false,
  });
  const optedOutQuestion = JSON.parse(requests[0].options.body);
  assert.equal(optedOutQuestion.event, 'question.created');
  assert.equal(optedOutQuestion.sms_eligible, false);
  assert.equal(optedOutQuestion.question.phone, null);

  requests.length = 0;
  await n8n.sendQuestionEvent({
    id: 8,
    email: 'owner@example.com',
    phone: '+15555550100',
    question: 'Can Autovyne send appointment reminders?',
    smsConsent: true,
  });
  const optedInQuestion = JSON.parse(requests[0].options.body);
  assert.equal(optedInQuestion.sms_eligible, true);
  assert.equal(optedInQuestion.question.phone, '+15555550100');

  const workingFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.includes('api.openai.com')) {
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'model is at capacity' } }),
      };
    }
    return workingFetch(url, options);
  };
  const fallbackQualification = await openai.qualifyLead(lead);
  assert.equal(fallbackQualification.ai_status, 'fallback_pending_capacity_or_provider_issue');
  assert.equal(fallbackQualification.industry_trait, 'Urgency-first dispatcher');
  const fallbackAssistant = await askCustomerAssistant({
    question: 'What now?',
    account: { business_name: 'Example HVAC', industry: 'hvac', status: 'setup', services: {}, metrics: {} },
    events: [],
  });
  assert.ok(fallbackAssistant.includes('AI provider is busy'));
  global.fetch = workingFetch;

  console.log('Integration adapter smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
