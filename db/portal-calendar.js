const pool = require('./index');

async function createCalendarItem({
  accountId,
  title,
  detail,
  startsAt,
  endsAt,
  source = 'autovyne',
  status = 'planned',
  metadata = {},
  visibleToClient = true,
}) {
  const result = await pool.query(
    `INSERT INTO portal_calendar_items
       (account_id, title, detail, starts_at, ends_at, source, status, metadata, visible_to_client)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      accountId,
      title,
      detail || null,
      startsAt || null,
      endsAt || null,
      source || 'autovyne',
      status || 'planned',
      JSON.stringify(metadata || {}),
      Boolean(visibleToClient),
    ]
  );
  return result.rows[0];
}

async function listCalendarItems(accountId, { visibleOnly = true, limit = 20 } = {}) {
  const filter = visibleOnly ? 'AND visible_to_client = TRUE' : '';
  const result = await pool.query(
    `SELECT *
     FROM portal_calendar_items
     WHERE account_id = $1 ${filter}
     ORDER BY COALESCE(starts_at, created_at) DESC
     LIMIT $2`,
    [accountId, limit]
  );
  return result.rows;
}

module.exports = {
  createCalendarItem,
  listCalendarItems,
};
