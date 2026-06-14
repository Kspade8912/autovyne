const { fetchJsonWithRetry } = require('../lib/http');
const { compactIndustryProfile } = require('../lib/industry-ai-profiles');

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

  const industryProfile = compactIndustryProfile(lead.industry);
  try {
    const response = await fetchJsonWithRetry('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        store: false,
        max_output_tokens: 650,
        instructions: [
          'You qualify inbound leads for Autovyne, an AI automation agency for local businesses.',
          'Use the same Autovyne workflow for every industry: quantify missed-call risk, identify operational pain, recommend next action, and prepare a truthful call opener.',
          'Adapt only the language, risks, escalation rules, and discovery questions to the supplied industry profile.',
          'Return only compact JSON with keys: priority, pain_summary, recommended_next_action, call_opener, industry_trait, discovery_questions, escalation_rule.',
          'priority must be high, medium, or low. Use only facts supplied in the lead and industry profile. Do not guarantee revenue.',
        ].join(' '),
        input: JSON.stringify({
          industry_profile: industryProfile,
          lead: {
            business_name: lead.business_name,
            industry: lead.industry,
            website_url: lead.website_url,
            monthly_call_volume: lead.monthly_call_volume,
            miss_rate_pct: lead.miss_rate_pct,
            estimated_missed_leads: lead.estimated_missed_leads,
            estimated_monthly_loss: lead.estimated_monthly_loss,
          },
        }),
      }),
    }, 15000, { retries: 2, baseDelayMs: 300 });

    const output = extractOutputText(response).trim();
    if (!output) return null;

    try {
      return JSON.parse(output.replace(/^```json\s*|\s*```$/g, ''));
    } catch (_error) {
      return {
        priority: 'medium',
        pain_summary: output.slice(0, 1000),
        industry_trait: industryProfile.defining_trait,
        discovery_questions: industryProfile.discovery_questions,
        escalation_rule: industryProfile.escalation_rule,
      };
    }
  } catch (error) {
    console.error('[openai] qualify fallback:', error.message);
    return {
      priority: Number(lead.estimated_monthly_loss || 0) >= 5000 ? 'high' : 'medium',
      pain_summary: `${industryProfile.label}: AI review pending. Use missed-call risk, current tools, and estimated monthly loss for the first call brief.`,
      recommended_next_action: 'Review the lead manually, confirm fit, then use the industry call opener before outreach.',
      call_opener: `Quick question: how are you handling ${industryProfile.call_opener_angle} right now?`,
      industry_trait: industryProfile.defining_trait,
      discovery_questions: industryProfile.discovery_questions,
      escalation_rule: industryProfile.escalation_rule,
      ai_status: 'fallback_pending_capacity_or_provider_issue',
    };
  }
}

async function askAssistant({ role, question, context, maxOutputTokens = 700, model }) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) return 'Ask a question and I will help from the information Autovyne has available.';
  if (!isConfigured()) {
    return 'The AI assistant is not connected yet. Check OPENAI_API_KEY in Integration Health.';
  }

  try {
    const response = await fetchJsonWithRetry('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        store: false,
        max_output_tokens: maxOutputTokens,
        instructions: role,
        input: JSON.stringify({
          question: cleanQuestion.slice(0, 1200),
          context,
        }),
      }),
    }, 15000, { retries: 2, baseDelayMs: 300 });

    return extractOutputText(response).trim() || 'I could not generate a helpful answer from the available account context.';
  } catch (error) {
    console.error('[openai] assistant fallback:', error.message);
    return [
      'The AI provider is busy right now, but Autovyne is still running.',
      'Use the dashboard status, recent activity, SMS consent proof, and Integration Health to keep working.',
      'Try the assistant again in a few minutes.',
    ].join(' ');
  }
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
        industry_profile: compactIndustryProfile(account.industry),
        last_event_at: account.last_event_at,
      })),
      recent_leads: (snapshot?.leads || []).slice(0, 10),
      recent_questions: (snapshot?.questions || []).slice(0, 10),
      recent_consents: (snapshot?.consents || []).slice(0, 10).map(consent => ({
        consented: consent.consented,
        form_source: consent.form_source,
        recorded_at: consent.recorded_at,
      })),
      recent_client_requests: (snapshot?.clientRequests || []).slice(0, 10).map(request => ({
        id: request.id,
        business_name: request.business_name,
        request_type: request.request_type,
        priority: request.priority,
        status: request.status,
        reason: request.reason,
        created_at: request.created_at,
      })),
      legal_audits: (snapshot?.legalAudits || []).slice(0, 10).map(audit => ({
        id: audit.id,
        business_name: audit.business_name,
        risk_area: audit.risk_area,
        severity: audit.severity,
        status: audit.status,
        title: audit.title,
        recommended_action: audit.recommended_action,
      })),
      integrations: integrationStatus,
    },
  });
}

async function askLegalAuditAssistant({ question, audits, snapshot }) {
  return askAssistant({
    question,
    model: process.env.LEGAL_AUDIT_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    role: [
      'You are Autovyne Legal Audit AI, a compliance-support assistant for an admin dashboard.',
      'You operate at a stricter review level than the general Admin AI, but you cannot approve, dismiss, send, call, change billing, change consent, or take legal action.',
      'You must route decisions back to the admin for approval.',
      'Flag likely areas to review: TCPA/SMS consent, do-not-call, AI voice disclosure, privacy/data requests, subscription/cancellation, sensitive data minimization, and customer workflow instructions.',
      'Do not provide legal advice. Provide practical review steps, missing evidence, and what the admin should verify.',
    ].join(' '),
    context: {
      legal_audits: (audits || []).slice(0, 50),
      recent_client_requests: (snapshot?.clientRequests || []).slice(0, 20),
      recent_consents: (snapshot?.consents || []).slice(0, 20).map(consent => ({
        consented: consent.consented,
        form_source: consent.form_source,
        recorded_at: consent.recorded_at,
      })),
    },
    maxOutputTokens: 700,
  });
}

async function runLegalAuditAIReview({ subject, draft }) {
  if (!isConfigured() || process.env.LEGAL_AUDIT_AI_ENABLED === 'false') return draft;

  try {
    const response = await fetchJsonWithRetry('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.LEGAL_AUDIT_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        store: false,
        max_output_tokens: 550,
        instructions: [
          'You are Autovyne Legal Audit AI. Review the supplied operational event for compliance risk.',
          'Return only compact JSON with keys: severity, title, summary, recommended_action, risk_area.',
          'Allowed severity values: low, medium, high, critical.',
          'Do not provide legal advice, do not approve action, and do not claim compliance is guaranteed.',
          'Every output must require admin approval before action.',
        ].join(' '),
        input: JSON.stringify({ subject, draft }),
      }),
    }, 12000, { retries: 1, baseDelayMs: 300 });

    const output = extractOutputText(response).trim();
    if (!output) return draft;
    const parsed = JSON.parse(output.replace(/^```json\s*|\s*```$/g, ''));
    return {
      ...draft,
      severity: parsed.severity || draft.severity,
      title: parsed.title || draft.title,
      summary: parsed.summary || draft.summary,
      recommendedAction: parsed.recommended_action || draft.recommendedAction,
      riskArea: parsed.risk_area || draft.riskArea,
      auditModel: process.env.LEGAL_AUDIT_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      metadata: {
        ...(draft.metadata || {}),
        ai_reviewed: true,
      },
    };
  } catch (error) {
    console.error('[openai] legal audit fallback:', error.message);
    return {
      ...draft,
      metadata: {
        ...(draft.metadata || {}),
        ai_status: 'fallback_rule_guided_review',
      },
    };
  }
}

async function askCustomerAssistant({ question, account, events, actionRequests }) {
  const industryProfile = compactIndustryProfile(account?.industry);
  return askAssistant({
    question,
    role: [
      'You are Autovyne Customer Helper inside a client portal.',
      'Answer only from the provided account status, services, metrics, visible activity, and customer action requests.',
      'Use the provided industry profile to explain workflows in the customer business context.',
      'You cannot change billing, account settings, automations, SMS consent, or send messages.',
      'If the customer asks for a change, explain which Action Center request to submit or tell them to use the Questions page.',
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
        industry_profile: industryProfile,
      } : null,
      visible_events: (events || []).slice(0, 20).map(event => ({
        event_type: event.event_type,
        title: event.title,
        detail: event.detail,
        created_at: event.created_at,
      })),
      customer_action_requests: (actionRequests || []).slice(0, 12).map(request => ({
        request_type: request.request_type,
        priority: request.priority,
        status: request.status,
        subject_phone: request.subject_phone,
        subject_name: request.subject_name,
        reason: request.reason,
        created_at: request.created_at,
      })),
    },
    maxOutputTokens: 450,
  });
}

module.exports = {
  askAdminAssistant,
  askCustomerAssistant,
  askLegalAuditAssistant,
  isConfigured,
  qualifyLead,
  runLegalAuditAIReview,
};
