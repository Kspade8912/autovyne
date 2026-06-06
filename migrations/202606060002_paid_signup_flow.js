module.exports = {
  name: 'paid_signup_flow',
  up: async (client) => {
    await client.query(`
      ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
      ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
      ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
      ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
      ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS signup_orders (
        id BIGSERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        industry TEXT NOT NULL,
        website_url TEXT,
        current_tools TEXT,
        plan TEXT NOT NULL,
        portal_access_code_hash TEXT NOT NULL,
        sms_consent BOOLEAN NOT NULL DEFAULT FALSE,
        sms_consent_at TIMESTAMPTZ,
        onboarding JSONB NOT NULL DEFAULT '{}'::jsonb,
        payment_status TEXT NOT NULL DEFAULT 'pending_payment',
        stripe_checkout_session_id TEXT UNIQUE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        activated_account_id BIGINT REFERENCES client_accounts(id),
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS signup_orders_email_idx ON signup_orders (email);
      CREATE INDEX IF NOT EXISTS signup_orders_payment_status_idx ON signup_orders (payment_status);
      CREATE INDEX IF NOT EXISTS signup_orders_session_idx ON signup_orders (stripe_checkout_session_id);

      ALTER TABLE signup_orders ENABLE ROW LEVEL SECURITY;
    `);
  },
};
