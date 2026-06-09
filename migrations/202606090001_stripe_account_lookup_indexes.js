module.exports = {
  name: 'stripe_account_lookup_indexes',
  up: async (client) => {
    await client.query(`
      CREATE INDEX IF NOT EXISTS client_accounts_stripe_customer_idx
        ON client_accounts (stripe_customer_id);
      CREATE INDEX IF NOT EXISTS client_accounts_stripe_subscription_idx
        ON client_accounts (stripe_subscription_id);
    `);
  },
};
