const pool = require('./index');

async function listApprovedCustomerReviews({ limit = 6 } = {}) {
  const result = await pool.query(
    `SELECT *
     FROM customer_reviews
     WHERE status = 'approved'
     ORDER BY approved_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function listCustomerReviews({ limit = 100, status = 'all' } = {}) {
  const params = [limit];
  const filter = status && status !== 'all' ? 'WHERE status = $2' : '';
  if (filter) params.push(status);
  const result = await pool.query(
    `SELECT *
     FROM customer_reviews
     ${filter}
     ORDER BY created_at DESC
     LIMIT $1`,
    params
  );
  return result.rows;
}

async function createCustomerReview({
  accountId,
  businessName,
  reviewerName,
  reviewerRole,
  quote,
  rating,
  outcomeSummary,
  status = 'pending',
  source = 'admin',
}) {
  const approvedAt = status === 'approved' ? new Date().toISOString() : null;
  const result = await pool.query(
    `INSERT INTO customer_reviews
       (account_id, business_name, reviewer_name, reviewer_role, quote, rating, outcome_summary, status, source, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      accountId || null,
      businessName,
      reviewerName || null,
      reviewerRole || null,
      quote,
      rating || null,
      outcomeSummary || null,
      status,
      source,
      approvedAt,
    ]
  );
  return result.rows[0];
}

async function updateCustomerReviewStatus({ id, status }) {
  const approvedAt = status === 'approved' ? 'NOW()' : 'approved_at';
  const result = await pool.query(
    `UPDATE customer_reviews
     SET status = $2,
         approved_at = ${approvedAt},
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return result.rows[0] || null;
}

module.exports = {
  createCustomerReview,
  listApprovedCustomerReviews,
  listCustomerReviews,
  updateCustomerReviewStatus,
};
