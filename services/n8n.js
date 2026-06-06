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

async function sendPaidSignupEvent({ order, account }) {
  if (!isConfigured()) return null;

  const smsEligible = Boolean(order.sms_consent && order.phone);
  return fetchJson(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Autovyne-Secret': process.env.N8N_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
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
        website_url: order.website_url,
        current_tools: order.current_tools,
        plan: order.plan,
        billing_method: order.billing_method || 'automatic',
        onboarding: order.onboarding || {},
        paid_at: order.paid_at,
      },
      account: {
        id: account.id,
        status: account.status,
        plan: account.plan,
        billing_method: account.billing_method || order.billing_method || 'automatic',
      },
    }),
  }, 15000);
}

async function sendManualSignupEvent({ order, account }) {
  if (!isConfigured()) return null;

  const smsEligible = Boolean(order.sms_consent && order.phone);
  return fetchJson(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Autovyne-Secret': process.env.N8N_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
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
        website_url: order.website_url,
        current_tools: order.current_tools,
        plan: order.plan,
        billing_method: 'manual',
        onboarding: order.onboarding || {},
      },
      account: {
        id: account.id,
        status: account.status,
        plan: account.plan,
        billing_method: 'manual',
      },
    }),
  }, 15000);
}

module.exports = { isConfigured, sendLeadEvent, sendManualSignupEvent, sendPaidSignupEvent, sendQuestionEvent };
