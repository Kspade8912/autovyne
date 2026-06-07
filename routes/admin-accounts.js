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
    selectedEditAccount: null,
    selectedEvents: [],
    ...overrides,
  };
}

function accountInput(body) {
  const servicePreset = sanitizeString(body.service_preset);
  return {
    businessName: sanitizeString(body.business_name),
    contactName: sanitizeString(body.contact_name),
    email: sanitizeString(body.email),
    phone: sanitizeString(body.phone),
    status: sanitizeString(body.status) || 'setup',
    plan: sanitizeString(body.plan) || 'starter',
    billingMethod: sanitizeString(body.billing_method) || 'automatic',
    accessCode: sanitizeString(body.access_code),
    services: {
      ai_calling: body.ai_calling === 'true' || servicePreset === 'calling' || servicePreset === 'full',
      sms_followup: body.sms_followup === 'true' || servicePreset === 'sms' || servicePreset === 'full',
      crm_sync: body.crm_sync === 'true' || servicePreset === 'crm' || servicePreset === 'full',
      n8n_workflows: body.n8n_workflows === 'true' || servicePreset === 'workflow' || servicePreset === 'full',
      openai_qualification: body.openai_qualification === 'true' || servicePreset === 'full',
    },
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
      selectedEditAccount: null,
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
      selectedEditAccount: null,
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
