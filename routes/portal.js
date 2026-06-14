const { Router } = require('express');
const { getAccountById, getAccountByLogin, listAccountEvents, recordAccountEvent, updateAccountById } = require('../db/accounts');
const { createClientActionRequest, listClientActionRequests } = require('../db/client-actions');
const { listCalendarItems } = require('../db/portal-calendar');
const { getActionDefinition, getActionOptions, customerActionLabel, normalizeActionType } = require('../lib/client-action-requests');
const { sanitizeString } = require('../lib/security');
const { getRequestIp } = require('../lib/sms-consent');
const stripe = require('../services/stripe');
const { askCustomerAssistant } = require('../services/openai');
const { createAuditFromClientAction } = require('../services/legal-audit-runner');
const { buildOnboardingChecklist } = require('../lib/onboarding-checklist');
const {
  CALENDAR_PROVIDERS,
  FOLLOWUP_STYLES,
  UPDATE_CHANNELS,
  mergePreferences,
  preferenceSummary,
  preferencesFromBody,
} = require('../lib/business-preferences');

const router = Router();

function seo() {
  return {
    title: 'Client Portal - Autovyne',
    description: 'Log in to view your Autovyne setup, account status, call follow-up, text updates, lead tracking, and booking activity.',
    ogTitle: 'Client Portal - Autovyne',
    ogDescription: 'View your Autovyne account setup and automation activity.',
    ogUrl: 'https://autovyne.com/portal',
    canonical: 'https://autovyne.com/portal',
  };
}

function renderLogin(res, error = null) {
  res.render('portal', {
    authorized: false,
    account: null,
    onboardingChecklist: null,
    events: [],
    actionRequests: [],
    calendarItems: [],
    actionOptions: [],
    customerActionLabel,
    preferenceDetails: preferenceSummary({}),
    updateChannels: UPDATE_CHANNELS,
    calendarProviders: CALENDAR_PROVIDERS,
    followupStyles: FOLLOWUP_STYLES,
    error,
    actionError: null,
    actionSuccess: null,
    preferenceError: null,
    preferenceSuccess: null,
    seo: seo(),
    assistantQuestion: '',
    assistantResponse: null,
  });
}

async function loadPortalData(account, overrides = {}) {
  const [events, actionRequests, calendarItems] = await Promise.all([
    listAccountEvents(account.id, { visibleOnly: true, limit: 30 }),
    listClientActionRequests(account.id, { limit: 20 }),
    listCalendarItems(account.id, { visibleOnly: true, limit: 20 }).catch(() => []),
  ]);

  return {
    authorized: true,
    account,
    onboardingChecklist: buildOnboardingChecklist(account),
    events,
    actionRequests,
    calendarItems,
    actionOptions: getActionOptions(),
    customerActionLabel,
    preferenceDetails: preferenceSummary(account.preferences || {}),
    updateChannels: UPDATE_CHANNELS,
    calendarProviders: CALENDAR_PROVIDERS,
    followupStyles: FOLLOWUP_STYLES,
    error: null,
    actionError: null,
    actionSuccess: null,
    preferenceError: null,
    preferenceSuccess: null,
    seo: seo(),
    assistantQuestion: '',
    assistantResponse: null,
    ...overrides,
  };
}

router.get('/', async (req, res) => {
  const accountId = req.signedCookies?.portal_account_id;
  if (!accountId) return renderLogin(res);

  try {
    const account = await getAccountById(accountId);
    if (!account) {
      res.clearCookie('portal_account_id');
      return renderLogin(res);
    }
    res.render('portal', await loadPortalData(account));
  } catch (error) {
    console.error('[portal] load error:', error.message);
    renderLogin(res, 'The portal could not load right now. Please try again.');
  }
});

router.post('/login', async (req, res) => {
  const email = sanitizeString(req.body.email || '').toLowerCase();
  const accessCode = sanitizeString(req.body.access_code || '');

  if (!email || !accessCode) return renderLogin(res, 'Enter your email and access code.');

  try {
    const account = await getAccountByLogin(email, accessCode);
    if (!account) return res.status(401).render('portal', {
      authorized: false,
      account: null,
      onboardingChecklist: null,
      events: [],
      actionRequests: [],
      calendarItems: [],
      actionOptions: [],
      customerActionLabel,
      preferenceDetails: preferenceSummary({}),
      updateChannels: UPDATE_CHANNELS,
      calendarProviders: CALENDAR_PROVIDERS,
      followupStyles: FOLLOWUP_STYLES,
      error: 'Invalid email or access code.',
      actionError: null,
      actionSuccess: null,
      preferenceError: null,
      preferenceSuccess: null,
      seo: seo(),
      assistantQuestion: '',
      assistantResponse: null,
    });

    res.cookie('portal_account_id', String(account.id), {
      httpOnly: true,
      signed: true,
      maxAge: 12 * 60 * 60 * 1000,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    res.redirect('/portal');
  } catch (error) {
    console.error('[portal] login error:', error.message);
    renderLogin(res, 'The portal could not log you in right now.');
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('portal_account_id');
  res.redirect('/portal');
});

router.post('/assistant', async (req, res) => {
  const accountId = req.signedCookies?.portal_account_id;
  if (!accountId) return renderLogin(res, 'Log in before asking the portal assistant.');

  const assistantQuestion = sanitizeString(req.body.assistant_question);
  try {
    const account = await getAccountById(accountId);
    if (!account) {
      res.clearCookie('portal_account_id');
      return renderLogin(res, 'Log in before asking the portal assistant.');
    }
    const events = await listAccountEvents(account.id, { visibleOnly: true, limit: 30 });
    const actionRequests = await listClientActionRequests(account.id, { limit: 20 });
    const assistantResponse = await askCustomerAssistant({ question: assistantQuestion, account, events, actionRequests });
    res.render('portal', {
      ...(await loadPortalData(account, { events, actionRequests })),
      assistantQuestion,
      assistantResponse,
    });
  } catch (error) {
    console.error('[portal] assistant error:', error.message);
    const account = await getAccountById(accountId).catch(() => null);
    const events = account ? await listAccountEvents(account.id, { visibleOnly: true, limit: 30 }).catch(() => []) : [];
    const actionRequests = account ? await listClientActionRequests(account.id, { limit: 20 }).catch(() => []) : [];
    res.status(500).render('portal', {
      authorized: Boolean(account),
      account,
      onboardingChecklist: account ? buildOnboardingChecklist(account) : null,
      events,
      actionRequests,
      calendarItems: [],
      actionOptions: getActionOptions(),
      customerActionLabel,
      preferenceDetails: preferenceSummary(account?.preferences || {}),
      updateChannels: UPDATE_CHANNELS,
      calendarProviders: CALENDAR_PROVIDERS,
      followupStyles: FOLLOWUP_STYLES,
      error: null,
      actionError: null,
      actionSuccess: null,
      preferenceError: null,
      preferenceSuccess: null,
      seo: seo(),
      assistantQuestion,
      assistantResponse: 'The portal assistant could not answer right now. Please use Submit a Question or email kwaun.autovyne@gmail.com.',
    });
  }
});

router.post('/assistant.json', async (req, res) => {
  const accountId = req.signedCookies?.portal_account_id;
  if (!accountId) return res.status(401).json({ error: 'Log in before asking the portal assistant.' });

  const assistantQuestion = sanitizeString(req.body.question || req.body.assistant_question);
  try {
    const account = await getAccountById(accountId);
    if (!account) {
      res.clearCookie('portal_account_id');
      return res.status(401).json({ error: 'Log in before asking the portal assistant.' });
    }
    const [events, actionRequests] = await Promise.all([
      listAccountEvents(account.id, { visibleOnly: true, limit: 30 }),
      listClientActionRequests(account.id, { limit: 20 }),
    ]);
    const answer = await askCustomerAssistant({ question: assistantQuestion, account, events, actionRequests });
    res.json({ answer, level: 'customer', label: 'Autovyne Helper' });
  } catch (error) {
    console.error('[portal] assistant json error:', error.message);
    res.status(500).json({ error: 'The portal assistant could not answer right now.' });
  }
});

router.post('/actions', async (req, res) => {
  const accountId = req.signedCookies?.portal_account_id;
  if (!accountId) return renderLogin(res, 'Log in before sending an account action request.');

  try {
    const account = await getAccountById(accountId);
    if (!account) {
      res.clearCookie('portal_account_id');
      return renderLogin(res, 'Log in before sending an account action request.');
    }

    const requestType = normalizeActionType(req.body.request_type);
    const definition = getActionDefinition(requestType);
    const subjectPhone = sanitizeString(req.body.subject_phone);
    const subjectName = sanitizeString(req.body.subject_name);
    const priority = sanitizeString(req.body.priority);
    const reason = sanitizeString(req.body.reason);

    if (definition.requiresPhone && !subjectPhone) {
      return res.status(400).render('portal', await loadPortalData(account, {
        actionError: 'Enter the caller phone number so Autovyne knows who to block or review.',
      }));
    }

    if (!reason || reason.length < 8) {
      return res.status(400).render('portal', await loadPortalData(account, {
        actionError: 'Add a short note so Autovyne understands what action you want.',
      }));
    }

    const actionRequest = await createClientActionRequest({
      accountId: account.id,
      requestType,
      subjectPhone,
      subjectName,
      priority,
      reason,
      requestedByEmail: account.email,
      ipAddress: getRequestIp(req),
      userAgent: req.headers['user-agent'] || null,
    });
    createAuditFromClientAction({
      ...actionRequest,
      business_name: account.business_name,
      account_email: account.email,
    }).catch(error => console.error('[portal] legal audit error:', error.message));

    const target = subjectPhone
      ? ` for ${subjectName ? `${subjectName} at ` : ''}${subjectPhone}`
      : '';
    await recordAccountEvent({
      accountId: account.id,
      eventType: 'customer_action_request',
      title: `${definition.shortLabel} request submitted`,
      detail: `Customer requested: ${definition.label}${target}. Autovyne will review this before changing automation or outreach.`,
      metadata: {
        request_id: actionRequest.id,
        request_type: requestType,
        compliance_flags: actionRequest.compliance_flags,
      },
      visibleToClient: true,
    });

    res.render('portal', await loadPortalData(account, {
      actionSuccess: `${definition.shortLabel} request submitted. Autovyne will review it and keep the record in this portal.`,
    }));
  } catch (error) {
    console.error('[portal] action request error:', error.message);
    const account = await getAccountById(accountId).catch(() => null);
    if (!account) return renderLogin(res, 'The action request could not be saved right now.');
    res.status(500).render('portal', await loadPortalData(account, {
      actionError: 'The action request could not be saved right now. Please email kwaun.autovyne@gmail.com.',
    }));
  }
});

router.post('/preferences', async (req, res) => {
  const accountId = req.signedCookies?.portal_account_id;
  if (!accountId) return renderLogin(res, 'Log in before updating account preferences.');

  try {
    const account = await getAccountById(accountId);
    if (!account) {
      res.clearCookie('portal_account_id');
      return renderLogin(res, 'Log in before updating account preferences.');
    }

    const updates = preferencesFromBody({
      ...req.body,
      plan: account.plan,
      industry: account.industry,
      consultation_requested: account.preferences?.consultation?.requested ? 'true' : req.body.consultation_requested,
      service_needs: account.preferences?.consultation?.needs || req.body.service_needs,
      consultation_notes: account.preferences?.consultation?.notes || '',
      consultation_best_time: account.preferences?.consultation?.best_time || '',
    });
    const preferences = mergePreferences(account.preferences || {}, updates);
    const updated = await updateAccountById({
      id: account.id,
      businessName: account.business_name,
      contactName: account.contact_name,
      email: account.email,
      phone: account.phone,
      industry: account.industry,
      status: account.status,
      plan: account.plan,
      billingMethod: account.billing_method,
      accessCode: '',
      services: account.services || {},
      metrics: account.metrics || {},
      preferences,
      notes: account.notes,
    });
    const summary = preferenceSummary(preferences);

    await recordAccountEvent({
      accountId: account.id,
      eventType: 'preferences',
      title: 'Owner update preferences changed',
      detail: `Updates: ${summary.channels}. Calendar: ${summary.calendar}. Follow-up style: ${summary.followup}. Text delivery still requires valid consent before messages are sent.`,
      visibleToClient: true,
    });

    res.render('portal', await loadPortalData(updated, {
      preferenceSuccess: 'Preferences saved. Autovyne will use these choices when routing updates, bookings, and follow-up.',
    }));
  } catch (error) {
    console.error('[portal] preferences error:', error.message);
    const account = await getAccountById(accountId).catch(() => null);
    if (!account) return renderLogin(res, 'Preferences could not be saved right now.');
    res.status(500).render('portal', await loadPortalData(account, {
      preferenceError: 'Preferences could not be saved right now. Please try again or email kwaun.autovyne@gmail.com.',
    }));
  }
});

router.post('/billing', async (req, res) => {
  const accountId = req.signedCookies?.portal_account_id;
  if (!accountId) return renderLogin(res, 'Log in before opening billing settings.');

  try {
    const account = await getAccountById(accountId);
    if (!account) {
      res.clearCookie('portal_account_id');
      return renderLogin(res, 'Log in before opening billing settings.');
    }
    if ((account.billing_method || 'automatic') !== 'automatic' || !account.stripe_customer_id) {
      return res.status(400).render('portal', {
        ...(await loadPortalData(account)),
        error: 'Billing portal is available after an automatic Stripe subscription is active. For help, email kwaun.autovyne@gmail.com.',
      });
    }

    const session = await stripe.createBillingPortalSession({
      customerId: account.stripe_customer_id,
      returnPath: '/portal',
    });
    res.redirect(303, session.url);
  } catch (error) {
    console.error('[portal] billing portal error:', error.message);
    const account = await getAccountById(accountId).catch(() => null);
    const events = account ? await listAccountEvents(account.id, { visibleOnly: true, limit: 30 }).catch(() => []) : [];
    const actionRequests = account ? await listClientActionRequests(account.id, { limit: 20 }).catch(() => []) : [];
    res.status(500).render('portal', {
      authorized: Boolean(account),
      account,
      onboardingChecklist: account ? buildOnboardingChecklist(account) : null,
      events,
      actionRequests,
      calendarItems: [],
      actionOptions: getActionOptions(),
      customerActionLabel,
      preferenceDetails: preferenceSummary(account?.preferences || {}),
      updateChannels: UPDATE_CHANNELS,
      calendarProviders: CALENDAR_PROVIDERS,
      followupStyles: FOLLOWUP_STYLES,
      error: 'Billing settings could not open right now. Please email kwaun.autovyne@gmail.com.',
      actionError: null,
      actionSuccess: null,
      preferenceError: null,
      preferenceSuccess: null,
      seo: seo(),
      assistantQuestion: '',
      assistantResponse: null,
    });
  }
});

module.exports = router;
