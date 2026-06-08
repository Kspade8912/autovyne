const openai = require('./openai');
const hubspot = require('./hubspot');
const n8n = require('./n8n');
const stripe = require('./stripe');
const twilio = require('./twilio');

async function runStep(name, fn) {
  try {
    const result = await fn();
    return { name, status: result ? 'sent' : 'skipped' };
  } catch (error) {
    console.error(`[integrations] ${name} error:`, error.message);
    return { name, status: 'failed', error: error.message };
  }
}

async function processNewLead(lead) {
  let qualification = null;
  const automationLead = lead.sms_consent
    ? lead
    : { ...lead, phone: null, sms_eligible: false };

  const openaiResult = await runStep('openai', async () => {
    qualification = await openai.qualifyLead(automationLead);
    return qualification;
  });

  const [hubspotResult, n8nResult] = await Promise.all([
    runStep('hubspot', () => hubspot.upsertLead(automationLead)),
    runStep('n8n', () => n8n.sendLeadEvent(automationLead, qualification)),
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
      accountConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      senderConfigured: Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
      messagingServiceConfigured: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID),
    },
  };
}

module.exports = { processNewLead, getConfigurationStatus };
