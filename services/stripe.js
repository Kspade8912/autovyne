const crypto = require('crypto');

const STRIPE_API_VERSION = '2026-02-25.clover';

const PLAN_PRICE_ENV = {
  'smb-bundle': 'STRIPE_PRICE_SMB_BUNDLE',
  starter: 'STRIPE_PRICE_STARTER',
  professional: 'STRIPE_PRICE_PROFESSIONAL',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
};

const PLAN_SETUP_PRICE_ENV = {
  'smb-bundle': 'STRIPE_SETUP_PRICE_SMB_BUNDLE',
  starter: 'STRIPE_SETUP_PRICE_STARTER',
  professional: 'STRIPE_SETUP_PRICE_PROFESSIONAL',
  enterprise: 'STRIPE_SETUP_PRICE_ENTERPRISE',
};

function isConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function webhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

function getPlanPriceId(plan) {
  return process.env[PLAN_PRICE_ENV[plan] || PLAN_PRICE_ENV.starter] || null;
}

function getPlanSetupPriceId(plan) {
  return process.env[PLAN_SETUP_PRICE_ENV[plan] || PLAN_SETUP_PRICE_ENV.starter] || null;
}

function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'https://autovyne.com').replace(/\/+$/, '');
}

async function stripeRequest(path, params) {
  if (!isConfigured()) throw new Error('Stripe is not configured.');

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: params,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe request failed with ${response.status}`);
  }
  return data;
}

async function stripeGet(path, params) {
  if (!isConfigured()) throw new Error('Stripe is not configured.');
  const query = params ? `?${params.toString()}` : '';
  const response = await fetch(`https://api.stripe.com${path}${query}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe request failed with ${response.status}`);
  }
  return data;
}

async function createCheckoutSession(order) {
  const priceId = getPlanPriceId(order.plan);
  if (!priceId) throw new Error(`Stripe price ID is not configured for ${order.plan}.`);

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('customer_email', order.email);
  params.set('client_reference_id', String(order.id));
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  const setupPriceId = getPlanSetupPriceId(order.plan);
  if (setupPriceId) {
    params.set('line_items[1][price]', setupPriceId);
    params.set('line_items[1][quantity]', '1');
  }
  params.set('success_url', `${publicBaseUrl()}/signup/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${publicBaseUrl()}/signup/cancel?order_id=${order.id}`);
  params.set('metadata[signup_order_id]', String(order.id));
  params.set('metadata[plan]', order.plan);
  params.set('metadata[email]', order.email);
  params.set('allow_promotion_codes', 'true');

  return stripeRequest('/v1/checkout/sessions', params);
}

async function retrieveCheckoutSession(sessionId) {
  const params = new URLSearchParams();
  params.set('expand[0]', 'subscription');
  params.set('expand[1]', 'customer');
  return stripeGet(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, params);
}

function parseSignatureHeader(signatureHeader) {
  return signatureHeader.split(',').reduce((acc, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) return acc;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key === 'v1') acc.v1.push(value);
    if (key === 't') acc.t = value;
    return acc;
  }, { t: null, v1: [] });
}

function verifyWebhook(rawBody, signatureHeader) {
  if (!webhookConfigured()) throw new Error('Stripe webhook secret is not configured.');
  if (!rawBody || !signatureHeader) throw new Error('Missing Stripe webhook signature.');

  const parts = parseSignatureHeader(signatureHeader);
  if (!parts.t || parts.v1.length === 0) throw new Error('Invalid Stripe signature header.');

  const payload = `${parts.t}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody}`;
  const expected = crypto
    .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const isValid = parts.v1.some(signature => {
    const actual = Buffer.from(signature, 'hex');
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  });

  if (!isValid) {
    throw new Error('Invalid Stripe webhook signature.');
  }

  return JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
}

module.exports = {
  STRIPE_API_VERSION,
  createCheckoutSession,
  getPlanPriceId,
  getPlanSetupPriceId,
  isConfigured,
  retrieveCheckoutSession,
  verifyWebhook,
  webhookConfigured,
};
