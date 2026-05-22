/**
 * services/email.js
 * Owns: sending transactional emails via SMTP (nodemailer).
 * Does NOT own: SMTP credentials (env vars), lead storage (db/leads.js).
 *
 * Requires env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Falls back gracefully (logs warning, no crash) if env vars are missing.
 */
const nodemailer = require('nodemailer');

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function buildLeadEmailHtml(lead) {
  const { business_name, industry, monthly_call_volume, miss_rate_pct,
          website_url, estimated_missed_leads, estimated_monthly_loss, created_at } = lead;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">New Lead Submission — Autovyne</h2>
  <table style="width:100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; font-weight: bold; width: 40%;">Business</td><td style="padding: 8px;">${escapeHtml(business_name)}</td></tr>
    <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Industry</td><td style="padding: 8px;">${escapeHtml(industry)}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Monthly Call Volume</td><td style="padding: 8px;">${monthly_call_volume}</td></tr>
    <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Miss Rate</td><td style="padding: 8px;">${miss_rate_pct}%</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Website</td><td style="padding: 8px;">${website_url ? `<a href="${escapeHtml(website_url)}">${escapeHtml(website_url)}</a>` : '—'}</td></tr>
    <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Est. Missed Leads / mo</td><td style="padding: 8px; font-size: 1.2em; color: #e53e3e;">${estimated_missed_leads}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Est. Monthly Loss</td><td style="padding: 8px; font-size: 1.2em; color: #e53e3e;">$${estimated_monthly_loss.toLocaleString()}</td></tr>
    <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Submitted At</td><td style="padding: 8px;">${created_at ? new Date(created_at).toLocaleString() : '—'}</td></tr>
  </table>
  <p style="margin-top: 24px; color: #666; font-size: 0.9em;">
    View all leads: <a href="https://autovyne.polsia.app">autovyne.polsia.app</a>
  </p>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendLeadNotification(lead) {
  const transporter = createTransporter();
  const to = process.env.LEAD_NOTIFY_EMAIL || 'autovyne@polsia.app';
  const from = process.env.SMTP_FROM || 'Autovyne <noreply@autovyne.polsia.app>';

  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping notification for lead:', lead.id);
    return;
  }

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `New Lead: ${lead.business_name} (${lead.industry}) — $${lead.estimated_monthly_loss?.toLocaleString()}/mo potential`,
      html: buildLeadEmailHtml(lead),
    });
    console.log(`[email] Lead notification sent for lead ${lead.id}`);
  } catch (err) {
    console.error('[email] Failed to send lead notification:', err.message);
  }
}

module.exports = { sendLeadNotification };