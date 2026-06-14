const { fetchJson } = require('../lib/http');
const { compactIndustryProfile } = require('../lib/industry-ai-profiles');

function isConfigured() {
  return Boolean(process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET);
}

async function logIntegrationIncident(payload) {
  try {
    const { recordIntegrationIncident } = require('../db/integration-incidents');
    await recordIntegrationIncident(payload);
  } catch (error) {
    console.error('[n8n] incident log error:', error.message);
  }
}

async function sendWorkflowEvent(payload, context = {}) {
  try {
    return await fetchJson(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Autovyne-Secret': process.env.N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    }, 15000);
  } catch (error) {
    await logIntegrationIncident({
      provider: 'n8n',
      operation: payload.event || 'workflow.event',
      severity: 'warning',
      message: error.message,
      context,
    });
    throw error;
  }
}

async function sendLeadEvent(lead, qualification) {
  if (!isConfigured()) return null;

  return sendWorkflowEvent({
      event: 'lead.created',
      sent_at: new Date().toISOString(),
      lead,
      industry_profile: compactIndustryProfile(lead.industry),
      sms_eligible: Boolean(lead.sms_consent && lead.phone),
      qualification,
    }, {
      lead_id: lead.id || null,
      industry: lead.industry || null,
      sms_eligible: Boolean(lead.sms_consent && lead.phone),
    });
}

async function sendQuestionEvent(question) {
  if (!isConfigured()) return null;

  const smsEligible = Boolean(question.smsConsent && question.phone);
  return sendWorkflowEvent({
      event: 'question.created',
      sent_at: new Date().toISOString(),
      sms_eligible: smsEligible,
      question: { ...question, phone: smsEligible ? question.phone : null },
    }, {
      email_present: Boolean(question.email),
      sms_eligible: smsEligible,
      category: question.category || null,
    });
}

async function sendPaidSignupEvent({ order, account }) {
  if (!isConfigured()) return null;

  const smsEligible = Boolean(order.sms_consent && order.phone);
  return sendWorkflowEvent({
      event: 'account.paid',
      sent_at: new Date().toISOString(),
      sms_eligible: smsEligible,
      order: {
        id: order.id,
        business_name: order.business_name,
        contact_name: order.contact_name,
        email: order.email,
        phone: smsEligible ? order.phone : null,
        industry: order.industry,
        industry_profile: compactIndustryProfile(order.industry),
        website_url: order.website_url,
        current_tools: order.current_tools,
        plan: order.plan,
        billing_method: order.billing_method || 'automatic',
        onboarding: order.onboarding || {},
        preferences: order.preferences || {},
        paid_at: order.paid_at,
      },
      account: {
        id: account.id,
        status: account.status,
        plan: account.plan,
        billing_method: account.billing_method || order.billing_method || 'automatic',
      },
    }, {
      order_id: order.id || null,
      account_id: account.id || null,
      plan: order.plan || null,
      sms_eligible: smsEligible,
    });
}

async function sendManualSignupEvent({ order, account }) {
  if (!isConfigured()) return null;

  const smsEligible = Boolean(order.sms_consent && order.phone);
  return sendWorkflowEvent({
      event: 'account.manual_billing_requested',
      sent_at: new Date().toISOString(),
      sms_eligible: smsEligible,
      order: {
        id: order.id,
        business_name: order.business_name,
        contact_name: order.contact_name,
        email: order.email,
        phone: smsEligible ? order.phone : null,
        industry: order.industry,
        industry_profile: compactIndustryProfile(order.industry),
        website_url: order.website_url,
        current_tools: order.current_tools,
        plan: order.plan,
        billing_method: 'manual',
        onboarding: order.onboarding || {},
        preferences: order.preferences || {},
      },
      account: {
        id: account.id,
        status: account.status,
        plan: account.plan,
        billing_method: 'manual',
      },
    }, {
      order_id: order.id || null,
      account_id: account.id || null,
      plan: order.plan || null,
      sms_eligible: smsEligible,
    });
}

async function sendDiagnosticEvent() {
  if (!isConfigured()) throw new Error('n8n is not configured.');

  return sendWorkflowEvent({
    event: 'diagnostic.autovyne',
    sent_at: new Date().toISOString(),
    sms_eligible: false,
    diagnostic: {
      source: 'admin_integration_health',
      message: 'Autovyne diagnostic event. No customer action required.',
    },
  }, {
    source: 'admin_integration_health',
  });
}

module.exports = {
  isConfigured,
  sendDiagnosticEvent,
  sendLeadEvent,
  sendManualSignupEvent,
  sendPaidSignupEvent,
  sendQuestionEvent,
};
