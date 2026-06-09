module.exports = {
  name: 'secure_migrations_table',
  up: async (client) => {
    await client.query(`
      ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON TABLE public._migrations FROM anon;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON TABLE public._migrations FROM authenticated;
        END IF;
      END $$;
    `);
  },
};
