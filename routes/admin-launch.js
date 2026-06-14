const { Router } = require('express');
const pool = require('../db');
const { hasAdminSession } = require('../lib/admin-auth');
const { getAdminSnapshot, listAccounts } = require('../db/accounts');
const { listIntegrationIncidents } = require('../db/integration-incidents');
const { getConfigurationStatus } = require('../services/integrations');
const { buildManualLaunchTasks, taskLabel } = require('../lib/manual-launch-tasks');
const { buildOnboardingChecklist } = require('../lib/onboarding-checklist');

const router = Router();

function serviceCount(account) {
  const services = account.services || {};
  return ['ai_calling', 'sms_followup', 'crm_sync', 'n8n_workflows', 'openai_qualification']
    .filter(key => services[key]).length;
}

function launchRows({ integrations, dbReachable, accounts, snapshot }) {
  const priceStatus = integrations.stripe?.pricesConfigured || {};
  const activeAccounts = accounts.filter(account => account.status === 'active').length;
  const setupAccounts = accounts.filter(account => account.status === 'setup').length;
  const reviewAccounts = accounts.filter(account => account.status === 'needs_attention').length;
  const launchReadyAccounts = accounts.filter(account => account.status === 'active' && serviceCount(account) >= 4).length;
  const consentProof = (snapshot.consents || []).filter(consent => consent.consented).length;

  return [
    {
      area: 'Foundation',
      label: 'Database reachable',
      ready: Boolean(integrations.supabase?.configured && dbReachable),
      detail: dbReachable ? 'Supabase/Postgres is reachable.' : 'Database connection needs review.',
      next: 'Keep this green before accepting new customer signup traffic.',
    },
    {
      area: 'Payments',
      label: 'Stripe subscriptions ready',
      ready: Boolean(integrations.stripe?.checkoutConfigured && integrations.stripe?.webhookConfigured && Object.values(priceStatus).every(Boolean)),
      detail: 'Requires checkout key, webhook secret, and all monthly price IDs.',
      next: 'Use automatic signup only when this is ready.',
    },
    {
      area: 'AI Stack',
      label: 'OpenAI, HubSpot, and n8n configured',
      ready: Boolean(integrations.openai?.configured && integrations.hubspot?.configured && integrations.n8n?.configured),
      detail: 'Powers lead review, CRM syncing, and workflow handoff.',
      next: 'If not ready, use Integration Health to add the missing Render key.',
    },
    {
      area: 'SMS',
      label: 'Twilio sender and consent proof',
      ready: Boolean(integrations.twilio?.configured && consentProof > 0),
      detail: `${consentProof} recent opted-in consent record${consentProof === 1 ? '' : 's'} visible.`,
      next: 'Do not send SMS unless the customer or lead has recorded consent.',
    },
    {
      area: 'Customers',
      label: 'Account pipeline visible',
      ready: accounts.length > 0,
      detail: `${accounts.length} managed account${accounts.length === 1 ? '' : 's'}: ${activeAccounts} active, ${setupAccounts} setup, ${reviewAccounts} review.`,
      next: 'Use Account Command Center to move setup accounts forward.',
    },
    {
      area: 'Launch',
      label: 'Launch-ready accounts',
      ready: launchReadyAccounts > 0,
      detail: `${launchReadyAccounts} account${launchReadyAccounts === 1 ? '' : 's'} active with most services enabled.`,
      next: 'Use this as your daily operational win counter.',
    },
  ];
}

router.get('/', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.redirect('/admin');

  const integrations = getConfigurationStatus();
  let dbReachable = false;
  try {
    await pool.query('SELECT 1');
    dbReachable = true;
    integrations.supabase.reachable = true;
  } catch (error) {
    integrations.supabase.reachable = false;
    integrations.supabase.error = error.message;
  }

  try {
    const [accounts, snapshot, incidents] = await Promise.all([
      listAccounts(),
      getAdminSnapshot(),
      listIntegrationIncidents({ limit: 10 }),
    ]);
    const rows = launchRows({ integrations, dbReachable, accounts, snapshot });
    const readyCount = rows.filter(row => row.ready).length;
    const manualTasks = buildManualLaunchTasks({ integrations, accounts, snapshot });
    const demoAccount = accounts.find(account => String(account.email || '').toLowerCase() === 'demo@autovyne.com') || null;
    res.render('admin-launch', {
      rows,
      readyCount,
      totalCount: rows.length,
      accounts,
      snapshot,
      integrations,
      incidents,
      manualTasks,
      taskLabel,
      demoAccount,
      demoChecklist: demoAccount ? buildOnboardingChecklist(demoAccount) : null,
    });
  } catch (error) {
    console.error('[admin-launch] load error:', error.message);
    res.status(500).render('admin-launch', {
      rows: [],
      readyCount: 0,
      totalCount: 0,
      accounts: [],
      snapshot: { leads: [], questions: [], consents: [] },
      incidents: [],
      manualTasks: [],
      taskLabel,
      demoAccount: null,
      demoChecklist: null,
      integrations,
      error: 'Launch checklist could not be loaded.',
    });
  }
});

module.exports = router;
