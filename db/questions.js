const pool = require('./index');

const QUESTION_STATUSES = ['new', 'reviewing', 'replied', 'closed'];

function normalizeStatus(status) {
  return QUESTION_STATUSES.includes(status) ? status : 'new';
}

async function createQuestion({
  name,
  businessName,
  email,
  phone,
  question,
  category = 'general',
  urgency = 'normal',
  contactPreference = 'email',
}) {
  const result = await pool.query(
    `INSERT INTO questions
       (name, business_name, email, phone, question, category, urgency, contact_preference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      name,
      businessName || null,
      email,
      phone || null,
      question,
      category || 'general',
      urgency || 'normal',
      contactPreference || 'email',
    ]
  );
  return result.rows[0];
}

async function listQuestions({ status = 'all', category = 'all', limit = 100 } = {}) {
  const filters = [];
  const values = [];
  if (status !== 'all') {
    values.push(normalizeStatus(status));
    filters.push(`status = $${values.length}`);
  }
  if (category !== 'all') {
    values.push(category);
    filters.push(`category = $${values.length}`);
  }
  values.push(limit);
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM questions
     ${where}
     ORDER BY
       CASE urgency WHEN 'urgent' THEN 0 WHEN 'soon' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

async function getQuestionById(id) {
  const result = await pool.query('SELECT * FROM questions WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateQuestionStatus({ id, status, ownerNote, adminReply }) {
  const normalized = normalizeStatus(status);
  const hasReply = String(adminReply || '').trim().length > 0;
  const result = await pool.query(
    `UPDATE questions SET
       status = $2,
       owner_note = NULLIF($3, ''),
       admin_reply = NULLIF($4, ''),
       replied_at = CASE WHEN $5::BOOLEAN THEN NOW() ELSE replied_at END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, normalized, ownerNote || '', adminReply || '', hasReply]
  );
  return result.rows[0] || null;
}

module.exports = {
  createQuestion,
  getQuestionById,
  listQuestions,
  QUESTION_STATUSES,
  updateQuestionStatus,
};
