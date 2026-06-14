const { Router } = require('express');
const {
  createOrUpdateAccount,
  getAdminSnapshot,
  getAccountById,
  listAccountEvents,
  listAccounts,
  recordAccountEvent,
  updateAccountById,
} = require('../db/accounts');
const { getClientActionRequestById, updateClientActionRequestStatus } = require('../db/client-actions');
const { sanitizeString } = require('../lib/security');
const { hasAdminSession, setAdminSession } = require('../lib/admin-auth');
const { INDUSTRY_AI_PROFILES, normalizeIndustry } = require('../lib/industry-ai-profiles');
const {
  filterServicesForPlan,
  getPlanServiceBundle,
  PLAN_SERVICE_BUNDLES,
  PLAN_SERVICE_NOTES,
  SERVICE_DEFINITIONS,
} = require('../lib/plan-services');
const { askAdminAssistant } = require('../services/openai');
const { getConfigurationStatus } = require('../services/integrations');

const router = Router();

const QUICK_ACTIONS = {
  onboarding_started: {
    eventType: 'onboarding',
    title: 'Onboarding started',
    detail: 'Autovyne has started setting up the account, automation tools, and customer follow-up workflow.',
    visibleToClient: true,
  },
  payment_confirmed: {
    eventType: 'billing',
    title: 'Payment confirmed',
    detail: 'Payment has been confirmed and Autovyne is moving this account through onboarding.',
    visibleToClient: true,
  },
  portal_activated: {
    eventType: 'portal',
    title: 'Customer portal activated',
    detail: 'The customer portal is active so the business owner can view setup status, activity, and account progress.',
    visibleToClient: true,
  },
  business_profile_received: {
    eventType: 'onboarding',
    title: 'Business profile reviewed',
    detail: 'Autovyne reviewed the business details, service area, basic contact rules, and onboarding goals for this account.',
    visibleToClient: true,
  },
  scripts_approved: {
    eventType: 'onboarding',
    title: 'Scripts and rules approved',
    detail: 'Autovyne reviewed the customer-facing call, follow-up, and escalation rules before turning on automation.',
    visibleToClient: true,
  },
  calendar_connected: {
    eventType: 'workflow',
    title: 'Booking or routing path connected',
    detail: 'Autovyne connected or documented the booking, routing, or escalation path for customer inquiries.',
    visibleToClient: true,
  },
  ai_calling_connected: {
    eventType: 'ai_calling',
    title: 'AI calling connected',
    detail: 'The AI calling workflow has been connected and is ready for monitored testing.',
    visibleToClient: true,
  },
  sms_ready: {
    eventType: 'sms',
    title: 'SMS follow-up ready',
    detail: 'SMS follow-up is ready for approved contacts with recorded consent.',
    visibleToClient: true,
  },
  crm_connected: {
    eventType: 'crm',
    title: 'CRM sync connected',
    detail: 'Lead and account updates are connected to the CRM workflow.',
    visibleToClient: true,
  },
  hubspot_connected: {
    eventType: 'crm',
    title: 'HubSpot connected',
    detail: 'HubSpot CRM syncing has been connected for lead and customer workflow updates.',
    visibleToClient: true,
  },
  n8n_connected: {
    eventType: 'workflow',
    title: 'Automation workflow connected',
    detail: 'The n8n automation workflow is connected for lead handoff, notifications, and internal follow-up.',
    visibleToClient: true,
  },
  openai_review_ready: {
    eventType: 'openai',
    title: 'AI lead review ready',
    detail: 'AI lead review is ready to summarize new leads and recommend next actions.',
    visibleToClient: true,
  },
  twilio_verified: {
    eventType: 'sms',
    title: 'SMS compliance verified',
    detail: 'SMS follow-up is configured for contacts with recorded consent and required compliance language.',
    visibleToClient: true,
  },
  launch_ready: {
    eventType: 'launch',
    title: 'Launch-ready check complete',
    detail: 'Autovyne has completed the launch checklist and the account is ready for live monitored usage.',
    visibleToClient: true,
  },
  customer_approval_received: {
    eventType: 'launch',
    title: 'Customer launch approval received',
    detail: 'The customer approved the visible setup direction, scripts, or workflow behavior for monitored launch.',
    visibleToClient: true,
  },
  monitoring_started: {
    eventType: 'launch',
    title: 'Launch monitoring started',
    detail: 'Autovyne started monitoring account activity, follow-up results, support requests, and automation health.',
    visibleToClient: true,
  },
  needs_review: {
    eventType: 'review',
    title: 'Needs Autovyne review',
    detail: 'This account needs an internal check before the next customer-facing update.',
    visibleToClient: false,
  },
};

const ACCOUNT_OPERATIONS = {
  start_setup: {
    label: 'Start setup',
    status: 'setup',
    services: {},
    eventType: 'onboarding',
    title: 'Setup started',
    detail: 'Autovyne has started setup and will turn on each service after it is connected and checked.',
    visibleToClient: true,
    notes: 'Setup started from admin operation preset.',
  },
  launch_full_stack: {
    label: 'Launch full stack',
    status: 'active',
    services: {
      ai_calling: true,
      sms_followup: true,
      crm_sync: true,
      n8n_workflows: true,
      openai_qualification: true,
    },
    eventType: 'launch',
    title: 'Launch-ready setup complete',
    detail: 'Autovyne marked AI calling, SMS follow-up, CRM sync, workflow automation, and AI lead review active.',
    visibleToClient: true,
    notes: 'Full stack marked active from admin operation preset. Confirm SMS consent before sending texts.',
  },
  sms_crm_ready: {
    label: 'SMS and CRM ready',
    status: 'setup',
    services: {
      sms_followup: true,
      crm_sync: true,
      n8n_workflows: true,
      openai_qualification: true,
    },
    eventType: 'sms',
    title: 'SMS and CRM workflow ready',
    detail: 'Autovyne marked SMS follow-up, CRM sync, and workflow automation ready for approved contacts.',
    visibleToClient: true,
    notes: 'SMS/CRM marked ready from admin operation preset. Confirm consent before sending texts.',
  },
  billing_review: {
    label: 'Needs billing review',
    status: 'needs_attention',
    services: {},
    eventType: 'billing',
    title: 'Billing review needed',
    detail: 'This account needs billing review before additional service changes are made.',
    visibleToClient: true,
    notes: 'Billing review required.',
  },
  pause_service: {
    label: 'Pause service',
    status: 'paused',
    services: {},
    eventType: 'review',
    title: 'Service paused',
    detail: 'Autovyne paused this account while the next step is reviewed.',
    visibleToClient: true,
    notes: 'Paused from admin operation preset.',
  },
};

function isAuthorized(req) {
  return hasAdminSession(req) || Boolean(process.env.ADMIN_API_KEY && req.signedCookies?.accounts_auth === 'authorized');
}

function normalizeFilters(query = {}) {
  return {
    search: sanitizeString(query.search || '').toLowerCase(),
    status: sanitizeString(query.status || 'all') || 'all',
    billing: sanitizeString(query.billing || 'all') || 'all',
    readiness: sanitizeString(query.readiness || 'all') || 'all',
  };
}

function readinessForAccount(account) {
  const services = account.services || {};
  const enabled = ['ai_calling', 'sms_followup', 'crm_sync', 'n8n_workflows', 'openai_qualification']
    .filter(key => services[key]).length;
  if (account.status === 'active' && enabled >= 4) return 'ready';
  if (account.status === 'needs_attention' || enabled === 0) return 'review';
  return 'setup';
}

function accountMatchesFilters(account, filters) {
  const haystack = [
    account.business_name,
    account.contact_name,
    account.email,
    account.phone,
    account.plan,
  ].map(value => String(value || '').toLowerCase()).join(' ');
  if (filters.search && !haystack.includes(filters.search)) return false;
  if (filters.status !== 'all' && account.status !== filters.status) return false;
  if (filters.billing !== 'all' && (account.billing_method || 'automatic') !== filters.billing) return false;
  if (filters.readiness !== 'all' && readinessForAccount(account) !== filters.readiness) return false;
  return true;
}

async function pageData(overrides = {}) {
  const [accounts, snapshot] = await Promise.all([
    listAccounts(),
    getAdminSnapshot(),
  ]);
  const filters = overrides.filters || normalizeFilters();
  const filteredAccounts = accounts.filter(account => accountMatchesFilters(account, filters));
  return {
    authorized: true,
    error: null,
    success: null,
    accounts,
    filteredAccounts,
    filters,
    snapshot,
    selectedAccount: null,
    selectedEditAccount: null,
    selectedEvents: [],
    assistantQuestion: '',
    assistantResponse: null,
    industryProfiles: INDUSTRY_AI_PROFILES,
    planServiceBundles: PLAN_SERVICE_BUNDLES,
    planServiceNotes: PLAN_SERVICE_NOTES,
    serviceDefinitions: SERVICE_DEFINITIONS,
    ...overrides,
  };
}

function accountInput(body) {
  const plan = sanitizeString(body.plan) || 'starter';
  return {
    businessName: sanitizeString(body.business_name),
    contactName: sanitizeString(body.contact_name),
    email: sanitizeString(body.email),
    phone: sanitizeString(body.phone),
    industry: normalizeIndustry(body.industry),
    status: sanitizeString(body.status) || 'setup',
    plan,
    billingMethod: sanitizeString(body.billing_method) || 'automatic',
    accessCode: sanitizeString(body.access_code),
    services: getPlanServiceBundle(plan),
    metrics: {
      calls_handled: body.calls_handled,
      sms_sent: body.sms_sent,
      crm_leads_synced: body.crm_leads_synced,
      missed_calls_recovered: body.missed_calls_recovered,
      estimated_revenue_recovered: body.estimated_revenue_recovered,
    },
    notes: sanitizeString(body.notes),
  };
}

function mergeServices(current = {}, updates = {}) {
  return {
    ai_calling: updates.ai_calling ?? Boolean(current.ai_calling),
    sms_followup: updates.sms_followup ?? Boolean(current.sms_followup),
    crm_sync: updates.crm_sync ?? Boolean(current.crm_sync),
    n8n_workflows: updates.n8n_workflows ?? Boolean(current.n8n_workflows),
    openai_qualification: updates.openai_qualification ?? Boolean(current.openai_qualification),
  };
}

function mergeServicesForPlan(plan, current = {}, updates = {}) {
  return filterServicesForPlan(plan, mergeServices(current, updates));
}

async function createSalesDemoAccount() {
  const accessCode = process.env.DEMO_PORTAL_ACCESS_CODE || 'AutovyneDemo2026!';
  const account = await createOrUpdateAccount({
    businessName: 'Autovyne Demo HVAC',
    contactName: 'Demo Owner',
    email: 'demo@autovyne.com',
    phone: '+18555025051',
    industry: 'hvac',
    status: 'active',
    plan: 'professional',
    billingMethod: 'automatic',
    accessCode,
    services: getPlanServiceBundle('professional'),
    metrics: {
      calls_handled: 48,
      sms_sent: 31,
      crm_leads_synced: 19,
      missed_calls_recovered: 14,
      estimated_revenue_recovered: 8400,
    },
    notes: 'Demo account for sales calls, tutorial walkthroughs, and customer portal previews. Do not use for real customer data.',
  });

  const demoEvents = [
    {
      eventType: 'billing',
      title: 'Payment confirmed',
      detail: 'Demo subscription payment confirmed so the portal can show the paid customer experience.',
    },
    {
      eventType: 'onboarding',
      title: 'Onboarding started',
      detail: 'Autovyne collected business goals, contact details, and workflow priorities for the demo account.',
    },
    {
      eventType: 'ai_calling',
      title: 'AI calling connected',
      detail: 'The AI calling workflow is marked active for the demo portal.',
    },
    {
      eventType: 'sms',
      title: 'SMS follow-up ready',
      detail: 'SMS follow-up is shown as ready for approved contacts with recorded consent.',
    },
    {
      eventType: 'crm',
      title: 'HubSpot CRM connected',
      detail: 'Demo lead activity is shown as synced into the CRM workflow.',
    },
    {
      eventType: 'workflow',
      title: 'n8n workflow connected',
      detail: 'Demo automation handoffs are active for call, message, CRM, and portal updates.',
    },
    {
      eventType: 'customer_action_request',
      title: 'Caller block request submitted',
      detail: 'Demo owner requested that a booked caller stop receiving follow-up. Autovyne logged the request for review.',
    },
  ];

  for (const event of demoEvents) {
    await recordAccountEvent({
      accountId: account.id,
      ...event,
      visibleToClient: true,
    });
  }

  return { account, accessCode };
}

router.get('/', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!isAuthorized(req)) {
    return res.render('admin-accounts', {
      authorized: false,
      error: null,
      success: null,
      accounts: [],
      filteredAccounts: [],
      filters: normalizeFilters(),
      snapshot: {},
      selectedAccount: null,
      selectedEditAccount: null,
      selectedEvents: [],
      assistantQuestion: '',
      assistantResponse: null,
    });
  }

  try {
    res.render('admin-accounts', await pageData({ filters: normalizeFilters(req.query) }));
  } catch (error) {
    console.error('[admin-accounts] load error:', error.message);
    res.render('admin-accounts', await pageData({ error: 'Failed to load account dashboard.', filters: normalizeFilters(req.query) }));
  }
});

router.post('/login', (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (req.body.key !== process.env.ADMIN_API_KEY) {
    return res.status(401).render('admin-accounts', {
      authorized: false,
      error: 'Invalid key',
      success: null,
      accounts: [],
      filteredAccounts: [],
      filters: normalizeFilters(),
      snapshot: {},
      selectedAccount: null,
      selectedEditAccount: null,
      selectedEvents: [],
      assistantQuestion: '',
      assistantResponse: null,
    });
  }

  res.cookie('accounts_auth', 'authorized', {
    httpOnly: true,
    signed: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  setAdminSession(res);
  res.redirect('/admin/accounts');
});

router.post('/', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  try {
    const account = await createOrUpdateAccount({
      ...accountInput(req.body),
    });

    await recordAccountEvent({
      accountId: account.id,
      eventType: 'account_update',
      title: 'Account dashboard updated',
      detail: 'Autovyne updated service status, metrics, or portal access.',
      visibleToClient: true,
    });

    res.render('admin-accounts', await pageData({ success: `Saved ${account.business_name}.` }));
  } catch (error) {
    console.error('[admin-accounts] save error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Account could not be saved.' }));
  }
});

router.get('/:id/edit', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  try {
    if (!Number.isInteger(Number(req.params.id))) {
      return res.status(404).render('admin-accounts', await pageData({ error: 'Account not found.' }));
    }
    const selectedEditAccount = await getAccountById(req.params.id);
    if (!selectedEditAccount) {
      return res.status(404).render('admin-accounts', await pageData({ error: 'Account not found.' }));
    }
    res.render('admin-accounts', await pageData({ selectedEditAccount }));
  } catch (error) {
    console.error('[admin-accounts] edit load error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Account edit form could not be loaded.' }));
  }
});

router.post('/account/:id', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  try {
    if (!Number.isInteger(Number(req.params.id))) {
      return res.status(404).render('admin-accounts', await pageData({ error: 'Account not found.' }));
    }
    const account = await updateAccountById({
      id: parseInt(req.params.id, 10),
      ...accountInput(req.body),
    });

    if (!account) {
      return res.status(404).render('admin-accounts', await pageData({ error: 'Account not found.' }));
    }

    await recordAccountEvent({
      accountId: account.id,
      eventType: 'account_update',
      title: 'Account dashboard updated',
      detail: 'Autovyne updated this account from the admin edit form.',
      visibleToClient: true,
    });

    res.render('admin-accounts', await pageData({ success: `Updated ${account.business_name}.` }));
  } catch (error) {
    console.error('[admin-accounts] edit save error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Account changes could not be saved.' }));
  }
});

router.post('/quick-action', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  const preset = QUICK_ACTIONS[sanitizeString(req.body.quick_action)];
  if (!preset) {
    return res.status(400).render('admin-accounts', await pageData({ error: 'Choose a valid quick action.' }));
  }

  try {
    await recordAccountEvent({
      accountId: parseInt(req.body.account_id, 10),
      eventType: preset.eventType,
      title: preset.title,
      detail: preset.detail,
      visibleToClient: req.body.visible_to_client ? req.body.visible_to_client === 'true' : preset.visibleToClient,
    });
    res.redirect('/admin/accounts');
  } catch (error) {
    console.error('[admin-accounts] quick action error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Quick action could not be saved.' }));
  }
});

router.post('/operation', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  const operation = ACCOUNT_OPERATIONS[sanitizeString(req.body.operation)];
  if (!operation) {
    return res.status(400).render('admin-accounts', await pageData({ error: 'Choose a valid account operation.' }));
  }

  try {
    const account = await getAccountById(parseInt(req.body.account_id, 10));
    if (!account) {
      return res.status(404).render('admin-accounts', await pageData({ error: 'Account not found.' }));
    }

    const updated = await updateAccountById({
      id: account.id,
      businessName: account.business_name,
      contactName: account.contact_name,
      email: account.email,
      phone: account.phone,
      industry: account.industry,
      status: operation.status,
      plan: account.plan,
      billingMethod: account.billing_method,
      accessCode: '',
      services: mergeServicesForPlan(account.plan, account.services || {}, operation.services || {}),
      metrics: account.metrics || {},
      notes: operation.notes || account.notes,
    });

    await recordAccountEvent({
      accountId: account.id,
      eventType: operation.eventType,
      title: operation.title,
      detail: operation.detail,
      visibleToClient: req.body.visible_to_client ? req.body.visible_to_client === 'true' : operation.visibleToClient,
    });

    res.render('admin-accounts', await pageData({ success: `${operation.label} saved for ${updated.business_name}.` }));
  } catch (error) {
    console.error('[admin-accounts] operation error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Account operation could not be saved.' }));
  }
});

router.post('/demo-account', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  try {
    const { account, accessCode } = await createSalesDemoAccount();
    res.render('admin-accounts', await pageData({
      success: `Demo account ready. Login at /portal with demo@autovyne.com and access code ${accessCode}.`,
      selectedEditAccount: account,
    }));
  } catch (error) {
    console.error('[admin-accounts] demo account error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Demo account could not be created.' }));
  }
});

router.post('/assistant', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  const assistantQuestion = sanitizeString(req.body.assistant_question);
  try {
    const [accounts, snapshot] = await Promise.all([
      listAccounts(),
      getAdminSnapshot(),
    ]);
    const assistantResponse = await askAdminAssistant({
      question: assistantQuestion,
      accounts,
      snapshot,
      integrationStatus: getConfigurationStatus(),
    });
    res.render('admin-accounts', await pageData({
      accounts,
      snapshot,
      assistantQuestion,
      assistantResponse,
    }));
  } catch (error) {
    console.error('[admin-accounts] assistant error:', error.message);
    res.status(500).render('admin-accounts', await pageData({
      assistantQuestion,
      assistantResponse: 'The admin assistant could not answer right now. Check Integration Health and try again.',
    }));
  }
});

router.post('/assistant.json', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Admin login required.' });

  const assistantQuestion = sanitizeString(req.body.question || req.body.assistant_question);
  try {
    const [accounts, snapshot] = await Promise.all([
      listAccounts(),
      getAdminSnapshot(),
    ]);
    const answer = await askAdminAssistant({
      question: assistantQuestion,
      accounts,
      snapshot,
      integrationStatus: getConfigurationStatus(),
    });
    res.json({
      answer,
      level: 'admin',
      label: 'Autovyne Admin AI',
      legalReviewCount: (snapshot.legalAudits || []).filter(audit => audit.status === 'needs_admin_review').length,
    });
  } catch (error) {
    console.error('[admin-accounts] assistant json error:', error.message);
    res.status(500).json({ error: 'The admin assistant could not answer right now.' });
  }
});

router.post('/client-requests/:id/status', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  try {
    const request = await getClientActionRequestById(parseInt(req.params.id, 10));
    if (!request) {
      return res.status(404).render('admin-accounts', await pageData({ error: 'Client request not found.' }));
    }

    const updated = await updateClientActionRequestStatus({
      id: request.id,
      status: sanitizeString(req.body.status),
      adminNote: sanitizeString(req.body.admin_note),
      reviewedBy: 'Autovyne admin',
    });

    await recordAccountEvent({
      accountId: request.account_id,
      eventType: 'customer_action_request',
      title: `Client request ${String(updated.status).replace(/_/g, ' ')}`,
      detail: updated.admin_note || `Autovyne updated the request status to ${String(updated.status).replace(/_/g, ' ')}.`,
      visibleToClient: true,
    });

    res.redirect('/admin/accounts#client-requests');
  } catch (error) {
    console.error('[admin-accounts] client request status error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Client request status could not be updated.' }));
  }
});

router.post('/events', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');

  try {
    await recordAccountEvent({
      accountId: parseInt(req.body.account_id, 10),
      eventType: sanitizeString(req.body.event_type) || 'update',
      title: sanitizeString(req.body.title),
      detail: sanitizeString(req.body.detail),
      visibleToClient: req.body.visible_to_client === 'true',
    });
    res.redirect('/admin/accounts');
  } catch (error) {
    console.error('[admin-accounts] event error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Activity event could not be saved.' }));
  }
});

router.get('/:id/events', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin/accounts');
  try {
    const accounts = await listAccounts();
    const selectedAccount = accounts.find(account => String(account.id) === String(req.params.id));
    const selectedEvents = selectedAccount ? await listAccountEvents(selectedAccount.id) : [];
    res.render('admin-accounts', await pageData({ selectedAccount, selectedEvents }));
  } catch (error) {
    console.error('[admin-accounts] event list error:', error.message);
    res.status(500).render('admin-accounts', await pageData({ error: 'Events could not be loaded.' }));
  }
});

module.exports = router;
