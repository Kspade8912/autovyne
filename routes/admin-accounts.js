const { Router } = require('express');
const {
  createOrUpdateAccount,
  getAdminSnapshot,
  listAccountEvents,
  listAccounts,
  recordAccountEvent,
} = require('../db/accounts');
const { sanitizeString } = require('../lib/security');
const { hasAdminSession, setAdminSession } = require('../lib/admin-auth');

const router = Router();

const QUICK_ACTIONS = {
  onboarding_started: {
    eventType: 'onboarding',
    title: 'Onboarding started',
    detail: 'Autovyne has started setting up the account, automation tools, and customer follow-up workflow.',
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
  needs_review: {
    eventType: 'review',
    title: 'Needs Autovyne review',
    detail: 'This account needs an internal check before the next customer-facing update.',
    visibleToClient: false,
  },
};

function isAuthorized(req) {
  return hasAdminSession(req) || Boolean(process.env.ADMIN_API_KEY && req.signedCookies?.accounts_auth === 'authorized');
}

async function pageData(overrides = {}) {
  const [accounts, snapshot] = await Promise.all([
    listAccounts(),
    getAdminSnapshot(),
  ]);
  return {
    authorized: true,
    error: null,
    success: null,
    accounts,
    snapshot,
    selectedAccount: null,
    selectedEvents: [],
    ...overrides,
  };
}

router.get('/', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!isAuthorized(req)) {
    return res.render('admin-accounts', {
      authorized: false,
      error: null,
      success: null,
      accounts: [],
      snapshot: {},
      selectedAccount: null,
      selectedEvents: [],
    });
  }

  try {
    res.render('admin-accounts', await pageData());
  } catch (error) {
    console.error('[admin-accounts] load error:', error.message);
    res.render('admin-accounts', await pageData({ error: 'Failed to load account dashboard.' }));
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
      snapshot: {},
      selectedAccount: null,
      selectedEvents: [],
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
      businessName: sanitizeString(req.body.business_name),
      contactName: sanitizeString(req.body.contact_name),
      email: sanitizeString(req.body.email),
      phone: sanitizeString(req.body.phone),
      status: sanitizeString(req.body.status) || 'setup',
      plan: sanitizeString(req.body.plan) || 'starter',
      billingMethod: sanitizeString(req.body.billing_method) || 'automatic',
      accessCode: sanitizeString(req.body.access_code),
      services: {
        ai_calling: req.body.ai_calling === 'true' || req.body.service_preset === 'calling' || req.body.service_preset === 'full',
        sms_followup: req.body.sms_followup === 'true' || req.body.service_preset === 'sms' || req.body.service_preset === 'full',
        crm_sync: req.body.crm_sync === 'true' || req.body.service_preset === 'crm' || req.body.service_preset === 'full',
        n8n_workflows: req.body.n8n_workflows === 'true' || req.body.service_preset === 'workflow' || req.body.service_preset === 'full',
        openai_qualification: req.body.openai_qualification === 'true' || req.body.service_preset === 'full',
      },
      metrics: {
        calls_handled: req.body.calls_handled,
        sms_sent: req.body.sms_sent,
        crm_leads_synced: req.body.crm_leads_synced,
        missed_calls_recovered: req.body.missed_calls_recovered,
        estimated_revenue_recovered: req.body.estimated_revenue_recovered,
      },
      notes: sanitizeString(req.body.notes),
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
