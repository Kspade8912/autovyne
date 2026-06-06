const { Router } = require('express');
const { createOrUpdateAccountWithHash, hashAccessCode, recordAccountEvent } = require('../db/accounts');
const { recordSmsConsent } = require('../db/compliance');
const {
  attachCheckoutSession,
  createSignupOrder,
  getSignupOrderById,
  getSignupOrderBySession,
  markSignupActivated,
  markSignupPaid,
} = require('../db/signup-orders');
const { createRateLimiter, sanitizeString, validateSubmission } = require('../lib/security');
const { SMS_CONSENT_TEXT, getRequestIp, hasSmsConsent } = require('../lib/sms-consent');
const n8n = require('../services/n8n');
const stripe = require('../services/stripe');

const router = Router();
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5 });

const PLAN_LABELS = {
  'smb-bundle': 'SMB Bundle',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

function validPlan(plan) {
  return PLAN_LABELS[plan] ? plan : 'professional';
}

function pageData(overrides = {}) {
  return {
    error: null,
    order: null,
    account: null,
    plans: PLAN_LABELS,
    stripeConfigured: stripe.isConfigured(),
    seo: {
      title: 'Sign Up - Autovyne',
      description: 'Start Autovyne onboarding, pay securely, and activate your AI automation portal.',
      ogTitle: 'Sign Up - Autovyne',
      ogDescription: 'Sign up for Autovyne AI calling, SMS follow-up, CRM sync, and onboarding automation.',
      ogUrl: 'https://autovyne.com/signup',
      canonical: 'https://autovyne.com/signup',
    },
    ...overrides,
  };
}

async function activatePaidOrder(order, session = {}) {
  if (!order || order.activated_account_id) {
    return {
      order,
      account: order?.activated_account_id ? { id: order.activated_account_id } : null,
      activated: false,
    };
  }

  const paidAt = order.paid_at || new Date().toISOString();
  const services = {
    ai_calling: true,
    sms_followup: Boolean(order.sms_consent),
    crm_sync: true,
    n8n_workflows: true,
    openai_qualification: true,
  };

  const account = await createOrUpdateAccountWithHash({
    businessName: order.business_name,
    contactName: order.contact_name,
    email: order.email,
    phone: order.phone,
    status: 'active',
    plan: order.plan,
    accessCodeHash: order.portal_access_code_hash,
    services,
    metrics: {},
    notes: 'Auto-created after successful paid signup.',
    stripeCustomerId: session.customer?.id || session.customer || order.stripe_customer_id,
    stripeCheckoutSessionId: session.id || order.stripe_checkout_session_id,
    stripeSubscriptionId: session.subscription?.id || session.subscription || order.stripe_subscription_id,
    paidAt,
    activatedAt: new Date().toISOString(),
  });

  await recordAccountEvent({
    accountId: account.id,
    eventType: 'payment_confirmed',
    title: 'Payment confirmed and portal activated',
    detail: 'Autovyne automatically approved this account and started onboarding after payment.',
    visibleToClient: true,
  });

  const activatedOrder = await markSignupActivated(order.id, account.id);
  n8n.sendPaidSignupEvent({ order: activatedOrder || order, account }).catch(error => {
    console.error('[signup] n8n paid signup error:', error.message);
  });

  return { order: activatedOrder || order, account, activated: true };
}

async function markSessionPaidAndActivate(session) {
  const orderId = parseInt(session.metadata?.signup_order_id || session.client_reference_id, 10);
  const order = orderId ? await getSignupOrderById(orderId) : await getSignupOrderBySession(session.id);
  if (!order) throw new Error('Signup order not found for Stripe session.');

  const paidOrder = await markSignupPaid({
    orderId: order.id,
    sessionId: session.id,
    customerId: session.customer?.id || session.customer || null,
    subscriptionId: session.subscription?.id || session.subscription || null,
  });

  return activatePaidOrder(paidOrder, session);
}

router.get('/', (req, res) => {
  res.render('signup', pageData({ selectedPlan: validPlan(req.query.plan) }));
});

router.post('/', limiter, async (req, res) => {
  if (validateSubmission(req, { honeypotField: '_honey', minSubmitMs: 3000 })) {
    return res.render('signup', pageData({ selectedPlan: validPlan(req.body.plan) }));
  }

  const data = {
    businessName: sanitizeString(req.body.business_name),
    contactName: sanitizeString(req.body.contact_name),
    email: sanitizeString(req.body.email || '').toLowerCase(),
    phone: sanitizeString(req.body.phone),
    industry: sanitizeString(req.body.industry),
    websiteUrl: sanitizeString(req.body.website_url),
    currentTools: sanitizeString(req.body.current_tools),
    plan: validPlan(req.body.plan),
    portalPassword: String(req.body.portal_password || ''),
    onboardingGoal: sanitizeString(req.body.onboarding_goal),
    smsConsent: hasSmsConsent(req.body.sms_consent),
    acceptedTerms: req.body.accept_terms === 'true',
  };

  if (!data.businessName || !data.contactName || !data.email || !data.industry) {
    return res.status(400).render('signup', pageData({ error: 'Please fill in your business, contact, email, and industry.', selectedPlan: data.plan }));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).render('signup', pageData({ error: 'Please enter a valid email address.', selectedPlan: data.plan }));
  }
  if (data.portalPassword.length < 8) {
    return res.status(400).render('signup', pageData({ error: 'Choose a portal password with at least 8 characters.', selectedPlan: data.plan }));
  }
  if (!data.acceptedTerms) {
    return res.status(400).render('signup', pageData({ error: 'Please accept the Terms of Service before continuing.', selectedPlan: data.plan }));
  }
  if (!stripe.isConfigured()) {
    return res.status(503).render('signup', pageData({
      error: 'Payments are not configured yet. Add Stripe keys and price IDs in Render before accepting paid signups.',
      selectedPlan: data.plan,
    }));
  }

  try {
    const order = await createSignupOrder({
      ...data,
      portalAccessCodeHash: hashAccessCode(data.portalPassword),
      onboarding: {
        goal: data.onboardingGoal,
        accepted_terms_at: new Date().toISOString(),
        minimum_service_months: 1,
      },
    });

    await recordSmsConsent({
      phone: data.phone,
      consented: data.smsConsent,
      formSource: 'paid_signup',
      sourceRecordType: 'signup_order',
      sourceRecordId: order.id,
      ipAddress: getRequestIp(req),
      userAgent: req.headers['user-agent'] || null,
      consentText: SMS_CONSENT_TEXT,
    });

    const session = await stripe.createCheckoutSession(order);
    await attachCheckoutSession(order.id, session.id);
    res.redirect(303, session.url);
  } catch (error) {
    console.error('[signup] create error:', error.message);
    res.status(500).render('signup', pageData({ error: error.message || 'Signup could not be started.', selectedPlan: data.plan }));
  }
});

router.get('/success', async (req, res) => {
  const sessionId = sanitizeString(req.query.session_id);
  if (!sessionId) return res.status(400).render('signup-status', pageData({ error: 'Missing checkout session.' }));

  try {
    const session = await stripe.retrieveCheckoutSession(sessionId);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.render('signup-status', pageData({ error: 'Payment is still pending. Refresh this page after payment completes.' }));
    }
    const result = await markSessionPaidAndActivate(session);
    res.render('signup-status', pageData({ order: result.order, account: result.account }));
  } catch (error) {
    console.error('[signup] success error:', error.message);
    res.status(500).render('signup-status', pageData({ error: 'Payment was received, but portal activation needs support review. Please email kwaun.autovyne@gmail.com.' }));
  }
});

router.get('/cancel', async (req, res) => {
  const order = req.query.order_id ? await getSignupOrderById(parseInt(req.query.order_id, 10)).catch(() => null) : null;
  res.render('signup-status', pageData({ error: 'Payment was canceled. Your portal was not activated.', order }));
});

router.post('/stripe-webhook', async (req, res) => {
  try {
    const event = stripe.verifyWebhook(req.rawBody, req.headers['stripe-signature']);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await markSessionPaidAndActivate(event.data.object);
    }
    res.json({ received: true });
  } catch (error) {
    console.error('[signup] stripe webhook error:', error.message);
    res.status(400).json({ error: 'Webhook rejected' });
  }
});

module.exports = router;
