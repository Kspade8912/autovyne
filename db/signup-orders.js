const pool = require('./index');

async function createSignupOrder({
  businessName,
  contactName,
  email,
  phone,
  industry,
  websiteUrl,
  currentTools,
  plan,
  portalAccessCodeHash,
  smsConsent,
  onboarding,
}) {
  const result = await pool.query(
    `INSERT INTO signup_orders
       (business_name, contact_name, email, phone, industry, website_url,
        current_tools, plan, portal_access_code_hash, sms_consent,
        sms_consent_at, onboarding)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $10 THEN NOW() ELSE NULL END,$11)
     RETURNING *`,
    [
      businessName,
      contactName,
      email,
      phone || null,
      industry,
      websiteUrl || null,
      currentTools || null,
      plan,
      portalAccessCodeHash,
      Boolean(smsConsent),
      JSON.stringify(onboarding || {}),
    ]
  );
  return result.rows[0];
}

async function getSignupOrderById(id) {
  const result = await pool.query('SELECT * FROM signup_orders WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getSignupOrderBySession(sessionId) {
  const result = await pool.query('SELECT * FROM signup_orders WHERE stripe_checkout_session_id = $1', [sessionId]);
  return result.rows[0] || null;
}

async function attachCheckoutSession(orderId, sessionId) {
  const result = await pool.query(
    `UPDATE signup_orders
     SET stripe_checkout_session_id = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, sessionId]
  );
  return result.rows[0] || null;
}

async function markSignupPaid({
  orderId,
  sessionId,
  customerId,
  subscriptionId,
}) {
  const result = await pool.query(
    `UPDATE signup_orders
     SET payment_status = 'paid',
         stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $2),
         stripe_customer_id = COALESCE($3, stripe_customer_id),
         stripe_subscription_id = COALESCE($4, stripe_subscription_id),
         paid_at = COALESCE(paid_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, sessionId || null, customerId || null, subscriptionId || null]
  );
  return result.rows[0] || null;
}

async function markSignupActivated(orderId, accountId) {
  const result = await pool.query(
    `UPDATE signup_orders
     SET payment_status = 'active',
         activated_account_id = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, accountId]
  );
  return result.rows[0] || null;
}

module.exports = {
  attachCheckoutSession,
  createSignupOrder,
  getSignupOrderById,
  getSignupOrderBySession,
  markSignupActivated,
  markSignupPaid,
};
