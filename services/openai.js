const { fetchJson } = require('../lib/http');

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const content = response?.output?.flatMap(item => item.content || []) || [];
  return content.find(item => item.type === 'output_text')?.text || '';
}

async function qualifyLead(lead) {
  if (!isConfigured()) return null;

  const response = await fetchJson('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      store: false,
      max_output_tokens: 500,
      instructions: [
        'You qualify inbound leads for Autovyne, an AI automation agency for local businesses.',
        'Return only compact JSON with keys: priority, pain_summary, recommended_next_action, call_opener.',
        'priority must be high, medium, or low. Use only facts supplied in the lead.',
      ].join(' '),
      input: JSON.stringify({
        business_name: lead.business_name,
        industry: lead.industry,
        website_url: lead.website_url,
        monthly_call_volume: lead.monthly_call_volume,
        miss_rate_pct: lead.miss_rate_pct,
        estimated_missed_leads: lead.estimated_missed_leads,
        estimated_monthly_loss: lead.estimated_monthly_loss,
      }),
    }),
  }, 15000);

  const output = extractOutputText(response).trim();
  if (!output) return null;

  try {
    return JSON.parse(output.replace(/^```json\s*|\s*```$/g, ''));
  } catch (_error) {
    return { priority: 'medium', pain_summary: output.slice(0, 1000) };
  }
}

async function askAssistant({ role, question, context, maxOutputTokens = 700 }) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) return 'Ask a question and I will help from the information Autovyne has available.';
  if (!isConfigured()) {
    return 'The AI assistant is not connected yet. Check OPENAI_API_KEY in Integration Health.';
  }

  const response = await fetchJson('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      store: false,
      max_output_tokens: maxOutputTokens,
      instructions: role,
      input: JSON.stringify({
        question: cleanQuestion.slice(0, 1200),
        context,
      }),
    }),
  }, 15000);

  return extractOutputText(response).trim() || 'I could not generate a helpful answer from the available account context.';
}

async function askAdminAssistant({ question, accounts, snapshot, integrationStatus }) {
  return askAssistant({
    question,
    role: [
      'You are Autovyne Admin Copilot for a first-time business owner.',
      'Give concise, practical operations guidance based only on the provided account, lead, question, compliance, and integration context.',
      'Prioritize billing issues, accounts needing attention, SMS consent risk, setup progress, and next best actions.',
      'Do not claim you changed data, sent SMS, called customers, or accessed external systems.',
      'Use simple language and a short action checklist when useful.',
    ].join(' '),
    context: {
      accounts: (accounts || []).slice(0, 50).map(account => ({
        id: account.id,
        business_name: account.business_name,
        status: account.status,
        plan: account.plan,
        billing_method: account.billing_method,
        services: account.services,
        metrics: account.metrics,
        last_event_at: account.last_event_at,
      })),
      recent_leads: (snapshot?.leads || []).slice(0, 10),
      recent_questions: (snapshot?.questions || []).slice(0, 10),
      recent_consents: (snapshot?.consents || []).slice(0, 10).map(consent => ({
        consented: consent.consented,
        form_source: consent.form_source,
        recorded_at: consent.recorded_at,
      })),
      integrations: integrationStatus,
    },
  });
}

async function askCustomerAssistant({ question, account, events }) {
  return askAssistant({
    question,
    role: [
      'You are Autovyne Customer Helper inside a client portal.',
      'Answer only from the provided account status, services, metrics, and visible activity.',
      'You cannot change billing, account settings, automations, SMS consent, or send messages.',
      'If the customer asks for a change, tell them to use the Questions page or email kwaun.autovyne@gmail.com.',
      'Keep the answer friendly, brief, and non-technical.',
    ].join(' '),
    context: {
      account: account ? {
        business_name: account.business_name,
        status: account.status,
        plan: account.plan,
        billing_method: account.billing_method,
        services: account.services,
        metrics: account.metrics,
      } : null,
      visible_events: (events || []).slice(0, 20).map(event => ({
        event_type: event.event_type,
        title: event.title,
        detail: event.detail,
        created_at: event.created_at,
      })),
    },
    maxOutputTokens: 450,
  });
}

module.exports = { askAdminAssistant, askCustomerAssistant, isConfigured, qualifyLead };
