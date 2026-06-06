const { Router } = require('express');
const { getAccountById, getAccountByLogin, listAccountEvents } = require('../db/accounts');
const { sanitizeString } = require('../lib/security');

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
  res.render('portal', { authorized: false, account: null, events: [], error, seo: seo() });
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
    res.render('portal', { authorized: true, account, events, error: null, seo: seo() });
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

module.exports = router;
