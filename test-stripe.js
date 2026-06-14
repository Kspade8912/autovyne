const assert = require('assert');
const crypto = require('crypto');

process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit';
process.env.STRIPE_PRICE_SMB_BUNDLE = 'price_smb_unit';
process.env.STRIPE_PRICE_STARTER = 'price_starter_unit';
process.env.STRIPE_PRICE_PROFESSIONAL = 'price_professional_unit';
process.env.STRIPE_PRICE_ENTERPRISE = 'price_enterprise_unit';
process.env.PUBLIC_BASE_URL = 'https://autovyne.test';

const requests = [];
global.fetch = async (url, options) => {
  requests.push({ url, options });
  if (url.includes('/v1/billing_portal/sessions')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'bps_test_unit',
        object: 'billing_portal.session',
        url: 'https://billing.stripe.com/p/session/test',
      }),
    };
  }
  if (url.includes('/v1/prices/')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: url.split('/').pop(),
        object: 'price',
        active: true,
        livemode: false,
        currency: 'usd',
        unit_amount: 29900,
        recurring: { interval: 'month' },
      }),
    };
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      id: 'cs_test_unit',
      object: 'checkout.session',
      url: 'https://checkout.stripe.com/c/pay/cs_test_unit',
    }),
  };
};

const stripe = require('./services/stripe');

(async () => {
  assert.equal(stripe.isConfigured(), true);
  assert.equal(stripe.webhookConfigured(), true);
  assert.equal(stripe.getPlanPriceId('smb-bundle'), 'price_smb_unit');

  const session = await stripe.createCheckoutSession({
    id: 123,
    email: 'owner@example.com',
    plan: 'smb-bundle',
  });

  assert.equal(session.id, 'cs_test_unit');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer sk_test_unit');

  const body = new URLSearchParams(requests[0].options.body);
  assert.equal(body.get('mode'), 'subscription');
  assert.equal(body.get('customer_email'), 'owner@example.com');
  assert.equal(body.get('line_items[0][price]'), 'price_smb_unit');
  assert.equal(body.get('success_url'), 'https://autovyne.test/signup/success?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(body.get('cancel_url'), 'https://autovyne.test/signup/cancel?order_id=123');
  assert.equal(body.get('metadata[signup_order_id]'), '123');
  assert.equal(body.get('allow_promotion_codes'), 'true');

  const billingSession = await stripe.createBillingPortalSession({
    customerId: 'cus_unit',
    returnPath: '/portal',
  });
  assert.equal(billingSession.id, 'bps_test_unit');
  const billingBody = new URLSearchParams(requests[1].options.body);
  assert.equal(requests[1].url, 'https://api.stripe.com/v1/billing_portal/sessions');
  assert.equal(billingBody.get('customer'), 'cus_unit');
  assert.equal(billingBody.get('return_url'), 'https://autovyne.test/portal');

  const priceStatus = await stripe.validateConfiguredPrices();
  assert.equal(priceStatus.ready, true);
  assert.equal(priceStatus.rows.length, 4);
  assert.equal(priceStatus.rows.every(row => row.interval === 'month'), true);

  const event = {
    id: 'evt_unit',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_unit',
        payment_status: 'paid',
        metadata: { signup_order_id: '123' },
      },
    },
  };
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  const parsed = stripe.verifyWebhook(rawBody, `t=${timestamp},v1=${signature}`);
  assert.equal(parsed.id, 'evt_unit');
  assert.equal(parsed.type, 'checkout.session.completed');

  assert.throws(
    () => stripe.verifyWebhook(rawBody, `t=${timestamp},v1=bad_signature`),
    /Invalid Stripe webhook signature/
  );

  console.log('Stripe checkout and webhook smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
