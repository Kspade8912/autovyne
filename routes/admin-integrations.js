const { Router } = require('express');
const pool = require('../db');
const { hasAdminSession } = require('../lib/admin-auth');
const { checkSupabaseSchema } = require('../db/diagnostics');
const hubspot = require('../services/hubspot');
const { getConfigurationStatus } = require('../services/integrations');
const n8n = require('../services/n8n');
const stripe = require('../services/stripe');
const twilio = require('../services/twilio');

const router = Router();

function flattenStatus(status) {
  const priceStatus = status.stripe?.pricesConfigured || {};
  const missingPrices = Object.entries(priceStatus)
    .filter(([, ready]) => !ready)
    .map(([name]) => name)
    .join(', ');
  return [
    {
      group: 'Database',
      name: 'Supabase/Postgres',
      ready: Boolean(status.supabase?.configured && status.supabase?.reachable),
      detail: status.supabase?.reachable ? 'Database is configured and reachable.' : 'Database env or connection needs review.',
      nextAction: status.supabase?.reachable ? 'No action needed.' : 'Check DATABASE_URL in Render and confirm the Supabase database is awake.',
    },
    {
      group: 'AI',
      name: 'OpenAI',
      ready: Boolean(status.openai?.configured),
      detail: status.openai?.configured ? `Model: ${status.openai.model}` : 'OPENAI_API_KEY is not configured.',
      nextAction: status.openai?.configured ? 'Use Admin AI and portal helper normally.' : 'Add OPENAI_API_KEY in Render before using AI assistants or lead review.',
    },
    {
      group: 'CRM',
      name: 'HubSpot',
      ready: Boolean(status.hubspot?.configured),
      detail: status.hubspot?.configured ? 'HubSpot access token is present.' : 'HUBSPOT_ACCESS_TOKEN is missing.',
      nextAction: status.hubspot?.configured ? 'New leads can sync to HubSpot.' : 'Create a HubSpot private app token and add HUBSPOT_ACCESS_TOKEN in Render.',
    },
    {
      group: 'Workflow',
      name: 'n8n',
      ready: Boolean(status.n8n?.configured),
      detail: status.n8n?.configured ? 'Webhook URL and shared secret are present.' : 'N8N_WEBHOOK_URL or N8N_WEBHOOK_SECRET is missing.',
      nextAction: status.n8n?.configured ? 'Signup, lead, and question events can flow into n8n.' : 'Add the n8n production webhook URL and matching shared secret in Render.',
    },
    {
      group: 'Billing',
      name: 'Stripe Checkout',
      ready: Boolean(status.stripe?.checkoutConfigured && Object.values(priceStatus).every(Boolean)),
      detail: Object.values(priceStatus).every(Boolean) ? 'Stripe secret key and all monthly price IDs are present.' : `Missing price IDs: ${missingPrices || 'review Stripe env values'}.`,
      nextAction: status.stripe?.checkoutConfigured && Object.values(priceStatus).every(Boolean) ? 'Checkout can create subscriptions.' : 'Add STRIPE_SECRET_KEY and every STRIPE_PRICE_* value in Render.',
    },
    {
      group: 'Billing',
      name: 'Stripe Webhook',
      ready: Boolean(status.stripe?.webhookConfigured),
      detail: status.stripe?.webhookConfigured ? 'Webhook signing secret is present.' : 'STRIPE_WEBHOOK_SECRET is missing.',
      nextAction: status.stripe?.webhookConfigured ? 'Paid signups can activate portal accounts.' : 'Create the Stripe webhook endpoint and add its signing secret in Render.',
    },
    {
      group: 'SMS',
      name: 'Twilio Account',
      ready: Boolean(status.twilio?.accountConfigured),
      detail: 'Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      nextAction: status.twilio?.accountConfigured ? 'Twilio account credentials are present.' : 'Add Twilio Account SID and Auth Token in Render.',
    },
    {
      group: 'SMS',
      name: 'Twilio Sender',
      ready: Boolean(status.twilio?.senderConfigured),
      detail: 'Requires a Twilio phone number or Messaging Service SID.',
      nextAction: status.twilio?.senderConfigured ? 'SMS can use the configured sender after consent checks.' : 'Add TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID in Render.',
    },
    {
      group: 'SMS',
      name: 'Twilio Status Callback',
      ready: Boolean(status.twilio?.statusCallbackConfigured),
      detail: status.twilio?.statusCallbackUrl || 'Uses PUBLIC_BASE_URL + /twilio/status by default.',
      nextAction: status.twilio?.statusCallbackConfigured ? 'Add this URL in Twilio messaging webhook/status callback settings.' : 'Set PUBLIC_BASE_URL or TWILIO_STATUS_CALLBACK_URL in Render.',
    },
    {
      group: 'SMS',
      name: 'Twilio Test Recipient',
      ready: Boolean(status.twilio?.testRecipientConfigured && status.twilio?.testConsentConfirmed),
      detail: status.twilio?.testRecipientConfigured ? 'A dedicated diagnostic test number is configured.' : 'No diagnostic test number is configured.',
      nextAction: status.twilio?.testRecipientConfigured && status.twilio?.testConsentConfirmed
        ? 'You can run Send Twilio Test SMS.'
        : 'Set TWILIO_TEST_TO_NUMBER and TWILIO_TEST_SMS_CONSENT=true only for your own opted-in test phone.',
    },
  ];
}

async function pageData(overrides = {}) {
  const status = getConfigurationStatus();
  let supabaseSchema = null;

  try {
    await pool.query('SELECT 1');
    status.supabase.reachable = true;
  } catch (error) {
    status.supabase.reachable = false;
    status.supabase.error = error.message;
  }

  if (status.supabase.reachable) {
    try {
      supabaseSchema = await checkSupabaseSchema();
    } catch (error) {
      supabaseSchema = {
        ready: false,
        tables: [],
        migrationsRlsEnabled: false,
        detail: error.message,
      };
    }
  }

  const rows = flattenStatus(status);
  const readyCount = rows.filter(row => row.ready).length;
  return {
    rows,
    readyCount,
    totalCount: rows.length,
    rawStatus: status,
    supabaseSchema,
    diagnosticResult: null,
    ...overrides,
  };
}

router.get('/', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.redirect('/admin');

  try {
    res.render('admin-integrations', await pageData());
  } catch (error) {
    console.error('[admin-integrations] load error:', error.message);
    res.status(500).render('admin-integrations', await pageData({
      diagnosticResult: { provider: 'integration_health', ready: false, detail: 'Integration Health could not fully load.' },
    }));
  }
});

router.post('/diagnostics/:provider', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.status(401).redirect('/admin');

  const provider = req.params.provider;
  let diagnosticResult = null;

  try {
    if (provider === 'supabase') {
      diagnosticResult = {
        provider: 'Supabase',
        ...(await checkSupabaseSchema()),
        detail: 'Checked required public tables and migration-table RLS.',
      };
    } else if (provider === 'hubspot') {
      const result = await hubspot.sendDiagnosticContact();
      diagnosticResult = {
        provider: 'HubSpot',
        ready: Boolean(result),
        detail: 'Diagnostic contact upsert succeeded.',
      };
    } else if (provider === 'n8n') {
      const result = await n8n.sendDiagnosticEvent();
      diagnosticResult = {
        provider: 'n8n',
        ready: Boolean(result),
        detail: 'Diagnostic workflow event was accepted by the configured webhook.',
      };
    } else if (provider === 'stripe-prices') {
      diagnosticResult = {
        provider: 'Stripe Prices',
        ...(await stripe.validateConfiguredPrices()),
        detail: 'Checked each configured monthly Price ID through Stripe.',
      };
    } else if (provider === 'twilio-account') {
      const result = await twilio.validateAccount();
      diagnosticResult = {
        provider: 'Twilio Account',
        ready: Boolean(result.ready),
        detail: result.detail,
      };
    } else if (provider === 'twilio-sms') {
      const result = await twilio.sendDiagnosticSms();
      diagnosticResult = {
        provider: 'Twilio Diagnostic SMS',
        ready: Boolean(result.ready),
        detail: result.detail,
      };
    } else {
      diagnosticResult = {
        provider,
        ready: false,
        detail: 'Unknown diagnostic provider.',
      };
    }
  } catch (error) {
    console.error('[admin-integrations] diagnostic error:', error.message);
    diagnosticResult = {
      provider,
      ready: false,
      detail: error.message,
    };
  }

  res.render('admin-integrations', await pageData({ diagnosticResult }));
});

module.exports = router;
