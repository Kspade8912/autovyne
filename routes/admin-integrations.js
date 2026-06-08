const { Router } = require('express');
const pool = require('../db');
const { hasAdminSession } = require('../lib/admin-auth');
const { getConfigurationStatus } = require('../services/integrations');

const router = Router();

function flattenStatus(status) {
  const priceStatus = status.stripe?.pricesConfigured || {};
  return [
    {
      group: 'Database',
      name: 'Supabase/Postgres',
      ready: Boolean(status.supabase?.configured && status.supabase?.reachable),
      detail: status.supabase?.reachable ? 'Database is configured and reachable.' : 'Database env or connection needs review.',
    },
    {
      group: 'AI',
      name: 'OpenAI',
      ready: Boolean(status.openai?.configured),
      detail: status.openai?.configured ? `Model: ${status.openai.model}` : 'OPENAI_API_KEY is not configured.',
    },
    {
      group: 'CRM',
      name: 'HubSpot',
      ready: Boolean(status.hubspot?.configured),
      detail: status.hubspot?.configured ? 'HubSpot access token is present.' : 'HUBSPOT_ACCESS_TOKEN is missing.',
    },
    {
      group: 'Workflow',
      name: 'n8n',
      ready: Boolean(status.n8n?.configured),
      detail: status.n8n?.configured ? 'Webhook URL and shared secret are present.' : 'N8N_WEBHOOK_URL or N8N_WEBHOOK_SECRET is missing.',
    },
    {
      group: 'Billing',
      name: 'Stripe Checkout',
      ready: Boolean(status.stripe?.checkoutConfigured && Object.values(priceStatus).every(Boolean)),
      detail: 'Requires STRIPE_SECRET_KEY and all four monthly price IDs.',
    },
    {
      group: 'Billing',
      name: 'Stripe Webhook',
      ready: Boolean(status.stripe?.webhookConfigured),
      detail: status.stripe?.webhookConfigured ? 'Webhook signing secret is present.' : 'STRIPE_WEBHOOK_SECRET is missing.',
    },
    {
      group: 'SMS',
      name: 'Twilio Account',
      ready: Boolean(status.twilio?.accountConfigured),
      detail: 'Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
    },
    {
      group: 'SMS',
      name: 'Twilio Sender',
      ready: Boolean(status.twilio?.senderConfigured),
      detail: 'Requires a Twilio phone number or Messaging Service SID.',
    },
  ];
}

router.get('/', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.redirect('/admin');

  const status = getConfigurationStatus();
  try {
    await pool.query('SELECT 1');
    status.supabase.reachable = true;
  } catch (error) {
    status.supabase.reachable = false;
    status.supabase.error = error.message;
  }

  const rows = flattenStatus(status);
  const readyCount = rows.filter(row => row.ready).length;
  res.render('admin-integrations', {
    rows,
    readyCount,
    totalCount: rows.length,
    rawStatus: status,
  });
});

module.exports = router;
