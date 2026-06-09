module.exports = {
  name: 'client_account_industry',
  up: async (client) => {
    await client.query(`
      ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS industry TEXT;
      CREATE INDEX IF NOT EXISTS client_accounts_industry_idx
        ON client_accounts (industry);
    `);
  },
};
