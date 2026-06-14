function labelStatus(status) {
  return {
    done: 'Ready',
    review: 'Review',
    manual: 'Manual',
  }[status] || 'Review';
}

function enabledServiceCount(account = {}) {
  const services = account.services || {};
  return ['ai_calling', 'sms_followup', 'crm_sync', 'n8n_workflows', 'openai_qualification']
    .filter(key => services[key]).length;
}

function isDemoAccount(account = {}) {
  return String(account.email || '').toLowerCase() === 'demo@autovyne.com';
}

function businessIdentityReady() {
  return Boolean(
    process.env.COMPANY_ENTITY_NAME &&
    process.env.BUSINESS_ADDRESS &&
    (process.env.SUPPORT_EMAIL || process.env.PUBLIC_SUPPORT_EMAIL)
  );
}

function row({ area, title, status, detail, evidence, action, href }) {
  return {
    area,
    title,
    status,
    detail,
    evidence,
    action,
    href,
  };
}

function buildWorkflowRehearsal({ integrations = {}, accounts = [], snapshot = {}, incidents = [], dbReachable = true } = {}) {
  const demoAccount = accounts.find(isDemoAccount);
  const demoServices = enabledServiceCount(demoAccount);
  const supportItems = snapshot.questions || [];
  const clientRequests = snapshot.clientRequests || [];
  const legalAudits = snapshot.legalAudits || [];
  const optedInConsents = (snapshot.consents || []).filter(consent => consent.consented);
  const openIncidents = incidents || [];

  const rows = [
    row({
      area: 'Database',
      title: 'Supabase data layer reachable',
      status: integrations.supabase?.configured && dbReachable ? 'done' : 'review',
      detail: 'Portal accounts, support questions, consent proof, activity events, and launch records need the database online.',
      evidence: dbReachable ? 'Database queries completed during this admin load.' : 'Database query failed or DATABASE_URL is missing.',
      action: 'Open Integration Health if this is yellow.',
      href: '/admin/integrations',
    }),
    row({
      area: 'Demo',
      title: 'Demo account can show the customer experience',
      status: demoAccount && demoAccount.status === 'active' && demoServices >= 4 ? 'done' : 'review',
      detail: 'Cold calls need a clean demo portal so prospects can see what they get after activation.',
      evidence: demoAccount ? `${demoAccount.business_name}: ${demoServices}/5 services active.` : 'Demo account is missing.',
      action: demoAccount ? 'Use demo@autovyne.com for walkthroughs.' : 'Create the demo account from Account Command Center.',
      href: demoAccount ? '/portal' : '/admin/accounts',
    }),
    row({
      area: 'AI',
      title: 'OpenAI assistant and fallback path ready',
      status: integrations.openai?.configured ? 'done' : 'review',
      detail: 'OpenAI powers lead review and assistants. The app now retries transient capacity errors before falling back.',
      evidence: integrations.openai?.configured ? `Configured model: ${integrations.openai.model}.` : 'OPENAI_API_KEY is missing.',
      action: integrations.openai?.configured ? 'Run normal assistant tests in the portal/admin pages.' : 'Add OpenAI key in Render before relying on AI helpers.',
      href: '/admin/integrations',
    }),
    row({
      area: 'CRM',
      title: 'HubSpot CRM handoff configured',
      status: integrations.hubspot?.configured ? 'done' : 'review',
      detail: 'New leads and account activity need a CRM destination for follow-up discipline.',
      evidence: integrations.hubspot?.configured ? 'HubSpot token is present.' : 'HUBSPOT_ACCESS_TOKEN is missing.',
      action: 'Use Integration Health to send a diagnostic HubSpot contact.',
      href: '/admin/integrations',
    }),
    row({
      area: 'Workflow',
      title: 'n8n automation handoff configured',
      status: integrations.n8n?.configured ? 'done' : 'review',
      detail: 'n8n is the workflow bridge between signup, questions, lead events, CRM, and internal notifications.',
      evidence: integrations.n8n?.configured ? 'n8n webhook URL and shared secret are present.' : 'N8N_WEBHOOK_URL or N8N_WEBHOOK_SECRET is missing.',
      action: 'Use Integration Health to send a diagnostic n8n event.',
      href: '/admin/integrations',
    }),
    row({
      area: 'Support',
      title: 'Support queue and client requests are visible',
      status: Array.isArray(supportItems) && Array.isArray(clientRequests) ? 'done' : 'review',
      detail: 'Customer questions and portal control requests need one place to review, prioritize, and close out.',
      evidence: `${supportItems.length} support question(s), ${clientRequests.length} client control request(s).`,
      action: 'Review Support Queue and Account Command Center daily.',
      href: '/admin/questions',
    }),
    row({
      area: 'Compliance',
      title: 'Consent and legal review proof visible',
      status: optedInConsents.length > 0 || legalAudits.length > 0 ? 'done' : 'review',
      detail: 'Before messaging or automation changes, you need proof records and review items visible to the admin.',
      evidence: `${optedInConsents.length} opted-in SMS consent record(s), ${legalAudits.length} legal audit item(s).`,
      action: 'Open SMS Proof and Legal Audits before any messaging scale-up.',
      href: '/admin/compliance',
    }),
    row({
      area: 'Business Details',
      title: 'Legal entity, business address, and support email finalized',
      status: businessIdentityReady() ? 'done' : 'manual',
      detail: 'Policies and outbound email footers should use real business identity details before heavy outreach.',
      evidence: businessIdentityReady() ? 'Business identity environment values are present.' : 'One or more placeholders remain for entity name, address, or support email.',
      action: 'Finalize these details with legal/business review.',
      href: '/terms',
    }),
    row({
      area: 'Monitoring',
      title: 'Integration incident watch is clear',
      status: openIncidents.length ? 'review' : 'done',
      detail: 'Open provider failures should be reviewed before outreach so signups and demos do not silently break.',
      evidence: `${openIncidents.length} open integration incident(s).`,
      action: openIncidents.length ? 'Open Launch Board and review recent automation alerts.' : 'Keep checking this daily during outreach.',
      href: '/admin/launch',
    }),
  ];

  const doneCount = rows.filter(item => item.status === 'done').length;
  const manualCount = rows.filter(item => item.status === 'manual').length;
  const reviewCount = rows.length - doneCount - manualCount;

  return {
    rows,
    doneCount,
    reviewCount,
    manualCount,
    totalCount: rows.length,
    score: rows.length ? Math.round((doneCount / rows.length) * 100) : 0,
    labelStatus,
  };
}

function buildDailyMonitoringRows({ snapshot = {}, incidents = [], accounts = [] } = {}) {
  const questions = snapshot.questions || [];
  const clientRequests = snapshot.clientRequests || [];
  const legalAudits = snapshot.legalAudits || [];
  const consents = snapshot.consents || [];
  const setupAccounts = accounts.filter(account => account.status === 'setup' || account.status === 'needs_attention');

  return [
    row({
      area: 'Morning',
      title: 'Check new signups and setup accounts',
      status: setupAccounts.length ? 'review' : 'done',
      detail: 'Move paid/setup accounts through onboarding before chasing new leads.',
      evidence: `${setupAccounts.length} account(s) need setup or review.`,
      action: 'Open Account Command Center.',
      href: '/admin/accounts',
    }),
    row({
      area: 'Morning',
      title: 'Answer support questions',
      status: questions.some(q => ['new', 'open'].includes(String(q.status || '').toLowerCase())) ? 'review' : 'done',
      detail: 'New questions should be answered before sales outreach so customers do not wait.',
      evidence: `${questions.length} recent question(s) visible.`,
      action: 'Open Support Queue.',
      href: '/admin/questions',
    }),
    row({
      area: 'Compliance',
      title: 'Review client control requests and legal audits',
      status: clientRequests.length || legalAudits.some(audit => audit.status === 'needs_admin_review') ? 'review' : 'done',
      detail: 'Caller blocks, privacy requests, billing changes, and consent-sensitive work require admin review.',
      evidence: `${clientRequests.length} client request(s), ${legalAudits.length} legal audit item(s).`,
      action: 'Open Legal Audits and Account Command Center.',
      href: '/admin/legal-audits',
    }),
    row({
      area: 'Monitoring',
      title: 'Clear integration incidents',
      status: incidents.length ? 'review' : 'done',
      detail: 'Provider errors can affect demos, signup activation, CRM sync, or automation handoff.',
      evidence: `${incidents.length} open incident(s).`,
      action: 'Review automation alerts.',
      href: '/admin/launch',
    }),
    row({
      area: 'Messaging',
      title: 'Check SMS consent proof before texts',
      status: consents.some(consent => consent.consented) ? 'done' : 'review',
      detail: 'SMS follow-up should only run for recipients with recorded proof or another documented lawful basis.',
      evidence: `${consents.filter(consent => consent.consented).length} opted-in consent record(s) in recent proof view.`,
      action: 'Open SMS Proof.',
      href: '/admin/compliance',
    }),
  ];
}

module.exports = {
  buildDailyMonitoringRows,
  buildWorkflowRehearsal,
  enabledServiceCount,
  labelStatus,
};
