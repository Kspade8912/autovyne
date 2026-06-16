const openai = require('./openai');
const hubspot = require('./hubspot');
const n8n = require('./n8n');
const stripe = require('./stripe');
const twilio = require('./twilio');

async function logIntegrationIncident(payload) {
  try {
    const { recordIntegrationIncident } = require('../db/integration-incidents');
    await recordIntegrationIncident(payload);
  } catch (error) {
    console.error('[integrations] incident log error:', error.message);
  }
}

async function runStep(name, fn, context = {}) {
  try {
    const result = await fn();
    return { name, status: result ? 'sent' : 'skipped' };
  } catch (error) {
    console.error(`[integrations] ${name} error:`, error.message);
    logIntegrationIncident({
      provider: name,
      operation: context.operation || 'lead.created',
      severity: 'warning',
      message: error.message,
      context,
    });
    return { name, status: 'failed', error: error.message };
  }
}

async function processNewLead(lead) {
  let qualification = null;
  const automationLead = lead.sms_consent
    ? lead
    : { ...lead, phone: null, sms_eligible: false };

  const incidentContext = {
    operation: 'lead.created',
    lead_id: lead.id || null,
    industry: lead.industry || null,
    sms_eligible: Boolean(automationLead.sms_eligible ?? automationLead.sms_consent),
  };

  const openaiResult = await runStep('openai', async () => {
    qualification = await openai.qualifyLead(automationLead);
    return qualification;
  }, incidentContext);

  const [hubspotResult, n8nResult] = await Promise.all([
    runStep('hubspot', () => hubspot.upsertLead(automationLead), incidentContext),
    runStep('n8n', () => n8n.sendLeadEvent(automationLead, qualification), incidentContext),
  ]);

  console.log('[integrations] lead processed:', lead.id, openaiResult.status, hubspotResult.status, n8nResult.status);
  return { qualification, steps: [openaiResult, hubspotResult, n8nResult] };
}

function getConfigurationStatus() {
  return {
    supabase: { configured: Boolean(process.env.DATABASE_URL) },
    openai: { configured: openai.isConfigured(), model: process.env.OPENAI_MODEL || 'gpt-5.4-mini' },
    hubspot: { configured: hubspot.isConfigured() },
    n8n: { configured: n8n.isConfigured() },
    stripe: {
      checkoutConfigured: stripe.isConfigured(),
      webhookConfigured: stripe.webhookConfigured(),
      pricesConfigured: {
        smbBundle: Boolean(stripe.getPlanPriceId('smb-bundle')),
        starter: Boolean(stripe.getPlanPriceId('starter')),
        professional: Boolean(stripe.getPlanPriceId('professional')),
        enterprise: Boolean(stripe.getPlanPriceId('enterprise')),
      },
    },
    twilio: {
      configured: twilio.isConfigured(),
      accountConfigured: twilio.isAccountConfigured(),
      authMode: twilio.authCredentials().mode,
      webhookValidationConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN),
      senderConfigured: Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
      messagingServiceConfigured: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID),
      statusCallbackConfigured: Boolean(process.env.TWILIO_STATUS_CALLBACK_URL || process.env.PUBLIC_BASE_URL),
      statusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL || (process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/twilio/status` : null),
      testRecipientConfigured: Boolean(process.env.TWILIO_TEST_TO_NUMBER),
      testConsentConfirmed: process.env.TWILIO_TEST_SMS_CONSENT === 'true',
    },
  };
}

module.exports = { processNewLead, getConfigurationStatus };
