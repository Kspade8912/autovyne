const { Router } = require('express');
const { hasAdminSession } = require('../lib/admin-auth');
const { getConfigurationStatus } = require('../services/integrations');
const { getAdminSnapshot, listAccounts } = require('../db/accounts');
const { buildManualLaunchTasks, taskLabel } = require('../lib/manual-launch-tasks');

const router = Router();

function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'https://autovyne.com').replace(/\/+$/, '');
}

async function checkHttp({ label, path, method = 'GET', body = null, expect = 200 }) {
  const url = `${publicBaseUrl()}${path}`;
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body,
    });
    const text = await response.text();
    return {
      label,
      path,
      ok: response.status === expect,
      status: response.status,
      ms: Date.now() - started,
      detail: text.slice(0, 180),
    };
  } catch (error) {
    return {
      label,
      path,
      ok: false,
      status: 'error',
      ms: Date.now() - started,
      detail: error.message,
    };
  }
}

async function runChecks() {
  const checks = await Promise.all([
    checkHttp({ label: 'Health check', path: '/health' }),
    checkHttp({ label: 'Signup page', path: '/signup' }),
    checkHttp({ label: 'Privacy Policy', path: '/privacy' }),
    checkHttp({ label: 'Terms of Service', path: '/terms' }),
    checkHttp({ label: 'SMS Terms', path: '/sms-terms' }),
    checkHttp({ label: 'SMS Compliance', path: '/sms-compliance' }),
    checkHttp({ label: 'Tutorial', path: '/tutorial' }),
    checkHttp({
      label: 'Twilio HELP webhook',
      path: '/twilio/sms',
      method: 'POST',
      body: new URLSearchParams({
        From: '+15550109999',
        Body: 'HELP',
        MessageSid: 'SM_admin_test_help',
      }).toString(),
    }),
  ]);

  const integrations = getConfigurationStatus();
  const configChecks = [
    {
      label: 'Stripe checkout config',
      ok: Boolean(integrations.stripe?.checkoutConfigured && Object.values(integrations.stripe?.pricesConfigured || {}).every(Boolean)),
      detail: 'Requires STRIPE_SECRET_KEY and every STRIPE_PRICE_* monthly price.',
    },
    {
      label: 'Stripe webhook config',
      ok: Boolean(integrations.stripe?.webhookConfigured),
      detail: 'Requires STRIPE_WEBHOOK_SECRET from the live Stripe endpoint.',
    },
    {
      label: 'AI/CRM/workflow config',
      ok: Boolean(integrations.openai?.configured && integrations.hubspot?.configured && integrations.n8n?.configured),
      detail: 'Requires OpenAI, HubSpot, and n8n Render keys.',
    },
    {
      label: 'Twilio config',
      ok: Boolean(integrations.twilio?.configured),
      detail: 'Requires Twilio account credentials and a sender number or messaging service.',
    },
  ];

  const [accounts, snapshot] = await Promise.all([
    listAccounts().catch(() => []),
    getAdminSnapshot().catch(() => ({ consents: [] })),
  ]);

  return {
    checks,
    configChecks,
    manualTasks: buildManualLaunchTasks({ integrations, accounts, snapshot }),
  };
}

router.get('/', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.redirect('/admin');

  try {
    const result = req.query.run === 'true'
      ? await runChecks()
      : { checks: [], configChecks: [], manualTasks: [] };
    res.render('admin-test-center', {
      ...result,
      baseUrl: publicBaseUrl(),
      ran: req.query.run === 'true',
      taskLabel,
    });
  } catch (error) {
    console.error('[admin-test-center] error:', error.message);
    res.status(500).render('admin-test-center', {
      checks: [],
      configChecks: [],
      manualTasks: [],
      baseUrl: publicBaseUrl(),
      ran: true,
      taskLabel,
      error: 'Test center could not run checks.',
    });
  }
});

module.exports = router;
