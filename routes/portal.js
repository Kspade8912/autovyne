const { Router } = require('express');
const { getAccountById, getAccountByLogin, listAccountEvents } = require('../db/accounts');
const { sanitizeString } = require('../lib/security');
const stripe = require('../services/stripe');
const { askCustomerAssistant } = require('../services/openai');

const router = Router();

function seo() {
  return {
    title: 'Client Portal - Autovyne',
    description: 'Log in to view your Autovyne automation setup, account status, AI calling, SMS, CRM, and workflow activity.',
    ogTitle: 'Client Portal - Autovyne',
    ogDescription: 'View your Autovyne account setup and automation activity.',
    ogUrl: 'https://autovyne.com/portal',
    canonical: 'https://autovyne.com/portal',
  };
}

function renderLogin(res, error = null) {
  res.render('portal', { authorized: false, account: null, events: [], error, seo: seo(), assistantQuestion: '', assistantResponse: null });
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
    const events = await listAccountEvents(account.id, { visibleOnly: true, limit: 30 });
    res.render('portal', { authorized: true, account, events, error: null, seo: seo(), assistantQuestion: '', assistantResponse: null });
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
      events: [],
      error: 'Invalid email or access code.',
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
    const assistantResponse = await askCustomerAssistant({ question: assistantQuestion, account, events });
    res.render('portal', {
      authorized: true,
      account,
      events,
      error: null,
      seo: seo(),
      assistantQuestion,
      assistantResponse,
    });
  } catch (error) {
    console.error('[portal] assistant error:', error.message);
    const account = await getAccountById(accountId).catch(() => null);
    const events = account ? await listAccountEvents(account.id, { visibleOnly: true, limit: 30 }).catch(() => []) : [];
    res.status(500).render('portal', {
      authorized: Boolean(account),
      account,
      events,
      error: null,
      seo: seo(),
      assistantQuestion,
      assistantResponse: 'The portal assistant could not answer right now. Please use Submit a Question or email kwaun.autovyne@gmail.com.',
    });
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
      const events = await listAccountEvents(account.id, { visibleOnly: true, limit: 30 });
      return res.status(400).render('portal', {
        authorized: true,
        account,
        events,
        error: 'Billing portal is available after an automatic Stripe subscription is active. For help, email kwaun.autovyne@gmail.com.',
        seo: seo(),
        assistantQuestion: '',
        assistantResponse: null,
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
    res.status(500).render('portal', {
      authorized: Boolean(account),
      account,
      events,
      error: 'Billing settings could not open right now. Please email kwaun.autovyne@gmail.com.',
      seo: seo(),
      assistantQuestion: '',
      assistantResponse: null,
    });
  }
});

module.exports = router;
