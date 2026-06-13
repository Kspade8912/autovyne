const pool = require('./index');

function cleanText(value, fallback = '') {
  return String(value || fallback).trim().slice(0, 1000);
}

function cleanSeverity(value) {
  return ['info', 'warning', 'critical'].includes(value) ? value : 'warning';
}

async function recordIntegrationIncident({
  provider,
  operation,
  severity = 'warning',
  message,
  context = {},
}) {
  if (!provider || !operation || !message) return null;

  const result = await pool.query(
    `INSERT INTO integration_incidents
       (provider, operation, severity, message, context)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      cleanText(provider, 'unknown'),
      cleanText(operation, 'unknown'),
      cleanSeverity(severity),
      cleanText(message, 'Integration failure'),
      JSON.stringify(context || {}),
    ]
  );
  return result.rows[0];
}

async function listIntegrationIncidents({ limit = 20, status = 'open' } = {}) {
  const result = await pool.query(
    `SELECT *
     FROM integration_incidents
     WHERE ($1::TEXT = 'all' OR status = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [status, limit]
  );
  return result.rows;
}

module.exports = {
  listIntegrationIncidents,
  recordIntegrationIncident,
};
