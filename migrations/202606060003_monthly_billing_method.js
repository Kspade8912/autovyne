module.exports = {
  name: 'monthly_billing_method',
  up: async (client) => {
    await client.query(`
      ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS billing_method TEXT NOT NULL DEFAULT 'automatic';
      ALTER TABLE signup_orders ADD COLUMN IF NOT EXISTS billing_method TEXT NOT NULL DEFAULT 'automatic';
      CREATE INDEX IF NOT EXISTS client_accounts_billing_method_idx ON client_accounts (billing_method);
      CREATE INDEX IF NOT EXISTS signup_orders_billing_method_idx ON signup_orders (billing_method);
    `);
  },
};
