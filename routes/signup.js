const { Router } = require('express');
const {
  createOrUpdateAccountWithHash,
  getAccountByStripeCustomer,
  getAccountByStripeSubscription,
  hashAccessCode,
  normalizeBillingMethod,
  recordAccountEvent,
  updateAccountStatusById,
} = require('../db/accounts');
const { recordSmsConsent } = require('../db/compliance');
const {
  attachCheckoutSession,
  createSignupOrder,
  getSignupOrderById,
  getSignupOrderBySession,
  markSignupActivated,
  markSignupManualBilling,
  markSignupPaid,
} = require('../db/signup-orders');
const { createRateLimiter, sanitizeString, validateSubmission } = require('../lib/security');
const { normalizeIndustry } = require('../lib/industry-ai-profiles');
const { SMS_CONSENT_TEXT, getRequestIp, hasSmsConsent } = require('../lib/sms-consent');
const n8n = require('../services/n8n');
const stripe = require('../services/stripe');

const router = Router();
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5 });

async function logIntegrationIncident(payload) {
  try {
    const { recordIntegrationIncident } = require('../db/integration-incidents');
    await recordIntegrationIncident(payload);
  } catch (error) {
    console.error('[signup] incident log error:', error.message);
  }
}

const PLAN_LABELS = {
  'smb-bundle': 'SMB Bundle',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

function validPlan(plan) {
  return PLAN_LABELS[plan] ? plan : 'professional';
}

function billingLabel(value) {
  return normalizeBillingMethod(value) === 'manual' ? 'Manual monthly billing' : 'Automatic monthly card payments';
}

function pageData(overrides = {}) {
  return {
    error: null,
    order: null,
    account: null,
    plans: PLAN_LABELS,
    billingLabel,
    manualBilling: false,
    selectedPlan: 'professional',
    selectedBillingMethod: 'automatic',
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

function publicSignupError(error, data) {
  if (process.env.NODE_ENV !== 'production') {
    return error.message || 'Signup could not be started.';
  }
  if (data?.billingMethod === 'automatic') {
    return 'Payment setup needs Autovyne review. Please choose manual monthly billing or email kwaun.autovyne@gmail.com.';
  }
  return 'Signup could not be started. Please try again or email kwaun.autovyne@gmail.com.';
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
    ai_calling: false,
    sms_followup: false,
    crm_sync: false,
    n8n_workflows: false,
    openai_qualification: false,
  };

  const account = await createOrUpdateAccountWithHash({
    businessName: order.business_name,
    contactName: order.contact_name,
    email: order.email,
    phone: order.phone,
    industry: normalizeIndustry(order.industry),
    status: 'setup',
    plan: order.plan,
    billingMethod: order.billing_method || 'automatic',
    accessCodeHash: order.portal_access_code_hash,
    services,
    metrics: {},
    notes: 'Auto-created after successful paid signup. Portal is active; automation setup is queued for Autovyne.',
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
    detail: 'Autovyne confirmed payment, activated the portal, and queued onboarding.',
    visibleToClient: true,
  });

  await recordAccountEvent({
    accountId: account.id,
    eventType: 'onboarding',
    title: 'Onboarding started',
    detail: 'Autovyne is preparing AI calling, SMS follow-up, CRM sync, and workflow automation for this account.',
    visibleToClient: true,
  });

  await recordAccountEvent({
    accountId: account.id,
    eventType: 'review',
    title: 'Automation setup queued',
    detail: 'Autovyne will turn on each automation area after it is connected and checked.',
    visibleToClient: true,
  });

  const activatedOrder = await markSignupActivated(order.id, account.id);
  n8n.sendPaidSignupEvent({ order: activatedOrder || order, account }).catch(error => {
    console.error('[signup] n8n paid signup error:', error.message);
  });

  return { order: activatedOrder || order, account, activated: true };
}

async function createManualBillingAccount(order) {
  const services = {
    ai_calling: false,
    sms_followup: false,
    crm_sync: false,
    n8n_workflows: false,
    openai_qualification: false,
  };

  const account = await createOrUpdateAccountWithHash({
    businessName: order.business_name,
    contactName: order.contact_name,
    email: order.email,
    phone: order.phone,
    industry: normalizeIndustry(order.industry),
    status: 'needs_attention',
    plan: order.plan,
    billingMethod: 'manual',
    accessCodeHash: order.portal_access_code_hash,
    services,
    metrics: {},
    notes: 'Manual monthly billing requested during signup. Do not start paid setup until payment is handled.',
    activatedAt: new Date().toISOString(),
  });

  await recordAccountEvent({
    accountId: account.id,
    eventType: 'manual_billing_requested',
    title: 'Manual monthly billing requested',
    detail: 'Autovyne received this signup without automatic card payments. Internal billing follow-up is required before paid setup begins.',
    visibleToClient: true,
  });

  const manualOrder = await markSignupManualBilling(order.id, account.id);
  n8n.sendManualSignupEvent({ order: manualOrder || order, account }).catch(error => {
    console.error('[signup] n8n manual signup error:', error.message);
  });

  return { order: manualOrder || order, account };
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

async function findAccountForStripeObject(object = {}) {
  const subscriptionId = object.subscription?.id ||
    object.subscription ||
    object.parent?.subscription_details?.subscription ||
    object.lines?.data?.find(line => line.subscription)?.subscription ||
    null;
  if (subscriptionId) {
    const account = await getAccountByStripeSubscription(subscriptionId);
    if (account) return account;
  }

  const customerId = object.customer?.id || object.customer || null;
  if (customerId) return getAccountByStripeCustomer(customerId);
  return null;
}

async function handleSubscriptionDeleted(subscription) {
  const account = await findAccountForStripeObject(subscription);
  if (!account) return null;

  const updated = await updateAccountStatusById({
    id: account.id,
    status: 'paused',
    notes: 'Stripe subscription ended. Review billing before resuming service.',
  });

  await recordAccountEvent({
    accountId: account.id,
    eventType: 'billing',
    title: 'Subscription ended',
    detail: 'Stripe reported that this subscription ended. Autovyne has paused the account until billing is reviewed.',
    visibleToClient: true,
  });

  return updated;
}

async function handleInvoicePaymentFailed(invoice) {
  const account = await findAccountForStripeObject(invoice);
  if (!account) return null;

  const updated = await updateAccountStatusById({
    id: account.id,
    status: 'needs_attention',
    notes: 'Stripe reported a failed subscription payment. Billing review is required.',
  });

  await recordAccountEvent({
    accountId: account.id,
    eventType: 'billing',
    title: 'Billing needs attention',
    detail: 'Stripe reported a failed payment. Please update billing or contact Autovyne for help.',
    visibleToClient: true,
  });

  return updated;
}

async function handleInvoicePaymentSucceeded(invoice) {
  const account = await findAccountForStripeObject(invoice);
  if (!account) return null;

  await recordAccountEvent({
    accountId: account.id,
    eventType: 'billing',
    title: 'Monthly payment received',
    detail: 'Stripe confirmed the latest monthly subscription payment.',
    visibleToClient: true,
  });

  return account;
}

router.get('/', (req, res) => {
  res.render('signup', pageData({
    selectedPlan: validPlan(req.query.plan),
    selectedBillingMethod: normalizeBillingMethod(req.query.billing_method),
  }));
});

router.post('/', limiter, async (req, res) => {
  if (validateSubmission(req, { honeypotField: '_honey', minSubmitMs: 3000 })) {
    return res.render('signup', pageData({
      selectedPlan: validPlan(req.body.plan),
      selectedBillingMethod: normalizeBillingMethod(req.body.billing_method),
    }));
  }

  const data = {
    businessName: sanitizeString(req.body.business_name),
    contactName: sanitizeString(req.body.contact_name),
    email: sanitizeString(req.body.email || '').toLowerCase(),
    phone: sanitizeString(req.body.phone),
    industry: normalizeIndustry(sanitizeString(req.body.industry)),
    websiteUrl: sanitizeString(req.body.website_url),
    currentTools: sanitizeString(req.body.current_tools),
    plan: validPlan(req.body.plan),
    billingMethod: normalizeBillingMethod(req.body.billing_method),
    portalPassword: String(req.body.portal_password || ''),
    onboardingGoal: sanitizeString(req.body.onboarding_goal),
    smsConsent: hasSmsConsent(req.body.sms_consent),
    acceptedTerms: req.body.accept_terms === 'true',
  };

  if (!data.businessName || !data.contactName || !data.email || !data.industry) {
    return res.status(400).render('signup', pageData({ error: 'Please fill in your business, contact, email, and industry.', selectedPlan: data.plan, selectedBillingMethod: data.billingMethod }));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).render('signup', pageData({ error: 'Please enter a valid email address.', selectedPlan: data.plan, selectedBillingMethod: data.billingMethod }));
  }
  if (data.portalPassword.length < 8) {
    return res.status(400).render('signup', pageData({ error: 'Choose a portal password with at least 8 characters.', selectedPlan: data.plan, selectedBillingMethod: data.billingMethod }));
  }
  if (!data.acceptedTerms) {
    return res.status(400).render('signup', pageData({ error: 'Please accept the Terms of Service before continuing.', selectedPlan: data.plan, selectedBillingMethod: data.billingMethod }));
  }
  if (data.billingMethod === 'automatic' && !stripe.isConfigured()) {
    return res.status(503).render('signup', pageData({
      error: 'Automatic payments are not configured yet. Add Stripe keys and monthly price IDs in Render before accepting automatic monthly payments, or choose manual monthly billing.',
      selectedPlan: data.plan,
      selectedBillingMethod: data.billingMethod,
    }));
  }

  try {
    const order = await createSignupOrder({
      ...data,
      portalAccessCodeHash: hashAccessCode(data.portalPassword),
      onboarding: {
        goal: data.onboardingGoal,
        billing_method: data.billingMethod,
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

    if (data.billingMethod === 'manual') {
      const result = await createManualBillingAccount(order);
      return res.render('signup-status', pageData({ order: result.order, account: result.account, manualBilling: true }));
    }

    const session = await stripe.createCheckoutSession(order);
    await attachCheckoutSession(order.id, session.id);
    return res.redirect(303, session.url);
  } catch (error) {
    console.error('[signup] create error:', error.message);
    res.status(500).render('signup', pageData({ error: publicSignupError(error, data), selectedPlan: data.plan, selectedBillingMethod: data.billingMethod }));
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
    } else if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(event.data.object);
    } else if (event.type === 'invoice.payment_failed') {
      await handleInvoicePaymentFailed(event.data.object);
    } else if (event.type === 'invoice.payment_succeeded') {
      await handleInvoicePaymentSucceeded(event.data.object);
    }
    res.json({ received: true });
  } catch (error) {
    console.error('[signup] stripe webhook error:', error.message);
    await logIntegrationIncident({
      provider: 'stripe',
      operation: 'webhook.receive',
      severity: 'critical',
      message: error.message,
      context: {
        signature_present: Boolean(req.headers['stripe-signature']),
        raw_body_present: Boolean(req.rawBody),
      },
    });
    res.status(400).json({ error: 'Webhook rejected' });
  }
});

module.exports = router;
