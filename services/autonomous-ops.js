const { serviceCompletion } = require('../lib/onboarding-checklist');
const { getConfigurationStatus } = require('./integrations');
const { askAssistant } = require('./openai');

function accountPriority(account) {
  const completion = serviceCompletion(account);
  if (account.status === 'needs_attention') return { severity: 'high', reason: 'Account is marked needs attention.' };
  if (account.status === 'paused') return { severity: 'high', reason: 'Account is paused and cannot run autonomously.' };
  if ((account.billing_method || 'automatic') === 'manual') return { severity: 'medium', reason: 'Manual billing requires owner review before full automation.' };
  if (completion.percent < 80) return { severity: 'medium', reason: `${completion.active}/${completion.total} automation areas are active.` };
  return { severity: 'low', reason: 'Account is active or close to live monitoring.' };
}

function integrationReviewItems(status = {}) {
  const rows = [];
  if (!status.openai?.configured) rows.push('Connect OpenAI so helper responses, lead review, and AI narratives can run.');
  if (!status.hubspot?.configured) rows.push('Connect HubSpot before relying on automatic lead hub updates.');
  if (!status.n8n?.configured) rows.push('Connect n8n before relying on background workflow handoffs.');
  if (!status.stripe?.configured) rows.push('Connect Stripe before automatic paid activation is trusted.');
  if (!status.twilio?.accountConfigured) rows.push('Add Twilio Account SID/Auth Token before live SMS sending.');
  if (!status.twilio?.senderConfigured) rows.push('Add Twilio sender before live SMS sending.');
  return rows;
}

function buildOpsBrief({ accounts = [], snapshot = {}, integrationStatus = {} }) {
  const activeAccounts = accounts.filter(account => account.status === 'active');
  const setupAccounts = accounts.filter(account => account.status === 'setup');
  const reviewAccounts = accounts.filter(account => ['needs_attention', 'paused'].includes(account.status));
  const legalReviews = (snapshot.legalAudits || []).filter(audit => audit.status === 'needs_admin_review');
  const clientRequests = (snapshot.clientRequests || []).filter(request => ['submitted', 'in_review'].includes(request.status));
  const newQuestions = (snapshot.questions || []).filter(question => ['new', 'reviewing'].includes(question.status || 'new'));
  const missingIntegrations = integrationReviewItems(integrationStatus);

  const accountPriorities = accounts
    .map(account => ({ account, ...accountPriority(account), completion: serviceCompletion(account) }))
    .filter(item => item.severity !== 'low')
    .slice(0, 8)
    .map(item => ({
      type: 'account',
      severity: item.severity,
      title: item.account.business_name,
      detail: item.reason,
      href: `/admin/accounts/${item.account.id}/edit`,
    }));

  const priorities = [
    ...missingIntegrations.map(detail => ({
      type: 'integration',
      severity: 'high',
      title: 'Integration setup needed',
      detail,
      href: '/admin/integrations',
    })),
    ...legalReviews.slice(0, 5).map(audit => ({
      type: 'legal_audit',
      severity: audit.severity || 'medium',
      title: audit.title || 'Legal audit review',
      detail: audit.recommended_action || audit.summary || 'Review before approving account action.',
      href: '/admin/legal-audits?status=needs_admin_review',
    })),
    ...clientRequests.slice(0, 5).map(request => ({
      type: 'client_request',
      severity: request.priority === 'urgent' ? 'high' : 'medium',
      title: `${request.business_name}: ${String(request.request_type || 'request').replace(/_/g, ' ')}`,
      detail: request.reason || 'Client action request needs review.',
      href: '/admin/accounts#client-requests',
    })),
    ...accountPriorities,
  ].slice(0, 12);

  const auditTasks = [
    'Review new client action requests before changing outreach, blocking callers, or pausing follow-up.',
    'Confirm SMS consent proof before any text follow-up is sent.',
    'Check do-not-contact, STOP, HELP, privacy, and AI disclosure records before outreach.',
    'Confirm customer-facing summaries do not expose sensitive call transcripts or payment data.',
  ];

  const coldCallingTasks = [
    'Use Outreach Board leads with clear business fit, estimated missed-call pain, and no do-not-contact flags.',
    'Open with missed-call recovery and portal transparency, not guaranteed revenue claims.',
    'Offer a demo account walkthrough so owners see calls, texts, bookings, and reports in one place.',
    'Log every interested business as a lead, then let AI summarize next steps before follow-up.',
  ];

  const manualSupport = [
    ...missingIntegrations,
    ...(legalReviews.length ? [`${legalReviews.length} legal audit item(s) need admin approval.`] : []),
    ...(clientRequests.length ? [`${clientRequests.length} customer control request(s) need review.`] : []),
    ...(newQuestions.length ? [`${newQuestions.length} support question(s) need a response.`] : []),
  ];

  const metrics = {
    accounts_total: accounts.length,
    accounts_active: activeAccounts.length,
    accounts_setup: setupAccounts.length,
    accounts_review: reviewAccounts.length,
    legal_reviews: legalReviews.length,
    client_requests: clientRequests.length,
    support_questions: newQuestions.length,
    integrations_missing: missingIntegrations.length,
  };

  const title = `Autovyne Daily Ops Brief - ${new Date().toLocaleDateString('en-US')}`;
  const summary = priorities.length
    ? `${priorities.length} priority item(s) need attention before Autovyne can be treated as fully autonomous.`
    : 'No urgent blockers found. Keep monitoring accounts, leads, support, and compliance proof.';

  return {
    title,
    summary,
    priorities,
    manualSupport,
    coldCallingTasks,
    auditTasks,
    metrics,
  };
}

async function generateAutonomousOpsReport({ persist = true } = {}) {
  const { getAdminSnapshot, listAccounts } = require('../db/accounts');
  const { createAutonomousOpsReport, listAutonomousOpsReports } = require('../db/autonomous-ops-reports');
  const [accounts, snapshot, previousReports] = await Promise.all([
    listAccounts(),
    getAdminSnapshot(),
    listAutonomousOpsReports({ limit: 3 }).catch(() => []),
  ]);
  const integrationStatus = getConfigurationStatus();
  const brief = buildOpsBrief({ accounts, snapshot, integrationStatus });

  let aiNarrative = null;
  try {
    aiNarrative = await askAssistant({
      question: 'Turn this Autovyne operations brief into a concise owner daily report with sections: Today first, Manual support, Audit watch, Cold call prep, and What can run automatically.',
      role: [
        'You are Autovyne Autonomous Operations AI.',
        'You help a solo business owner run accounts, compliance checks, outreach prep, and support without unnecessary manual work.',
        'Be direct, practical, and conservative. Never claim an action was performed unless the data says so.',
        'Risky actions like sending SMS, calling, changing billing, resolving legal audits, deleting data, or changing consent require admin approval.',
      ].join(' '),
      context: {
        brief,
        previous_reports: previousReports.map(report => ({
          title: report.title,
          summary: report.summary,
          created_at: report.created_at,
        })),
      },
      maxOutputTokens: 900,
    });
  } catch (error) {
    console.error('[autonomous-ops] narrative fallback:', error.message);
  }

  if (!persist) return { ...brief, aiNarrative };

  const report = await createAutonomousOpsReport({
    ...brief,
    reportType: 'daily',
    aiNarrative,
  });
  return report;
}

module.exports = {
  buildOpsBrief,
  generateAutonomousOpsReport,
};
