const pool = require('./index');

async function createQuestion({ name, businessName, email, phone, question }) {
  const result = await pool.query(
    `INSERT INTO questions (name, business_name, email, phone, question)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [name, businessName || null, email, phone || null, question]
  );
  return result.rows[0];
}

module.exports = { createQuestion };
