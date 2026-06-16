const pool = require('./index');

async function createAutonomousOpsReport({
  reportType = 'daily',
  status = 'generated',
  title,
  summary,
  priorities,
  manualSupport,
  coldCallingTasks,
  auditTasks,
  metrics,
  aiNarrative,
  generatedBy = 'autovyne_ops_ai',
}) {
  const result = await pool.query(
    `INSERT INTO autonomous_ops_reports
       (report_type, status, title, summary, priorities, manual_support, cold_calling_tasks, audit_tasks, metrics, ai_narrative, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      reportType,
      status,
      title,
      summary,
      JSON.stringify(priorities || []),
      JSON.stringify(manualSupport || []),
      JSON.stringify(coldCallingTasks || []),
      JSON.stringify(auditTasks || []),
      JSON.stringify(metrics || {}),
      aiNarrative || null,
      generatedBy,
    ]
  );
  return result.rows[0];
}

async function listAutonomousOpsReports({ limit = 10 } = {}) {
  const result = await pool.query(
    `SELECT *
     FROM autonomous_ops_reports
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = {
  createAutonomousOpsReport,
  listAutonomousOpsReports,
};
