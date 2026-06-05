/**
 * services/email.js
 * Owns: sending transactional emails — internal lead notifications (SMTP/nodemailer)
 *       and prospect auto-replies (Polsia email proxy).
 * Does NOT own: SMTP credentials (env vars), lead storage (db/leads.js).
 *
 * Internal notifications: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Auto-replies:           POLSIA_API_KEY (auto-provisioned on Render)
 */
const nodemailer = require('nodemailer');

// ── SMTP (internal lead notification) ────────────────────────────────────────

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
      View all leads: <a href="https://autovyne.com">autovyne.com</a>
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
  const to = process.env.LEAD_NOTIFY_EMAIL || 'hello@autovyne.com';
  const from = process.env.SMTP_FROM || 'Autovyne <hello@autovyne.com>';

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

// ── Auto-reply to prospects (Polsia email proxy) ──────────────────────────────

// In-memory 24h dedup: maps lowercased business_name → timestamp of last send.
// Prevents spam if a prospect resubmits the form within 24 hours.
// Intentionally in-memory (not DB) — a restart resets it, which is acceptable.
const autoReplySentAt = new Map();
const AUTO_REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function buildAutoReplyHtml(lead) {
  const { business_name, estimated_missed_leads, estimated_monthly_loss } = lead;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Free Lead Audit Results</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0f0f0f;padding:28px 36px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Autovyne</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 24px;">
              <p style="margin:0 0 20px;font-size:16px;color:#333;">Hi ${escapeHtml(business_name)} team,</p>

              <p style="margin:0 0 24px;font-size:16px;color:#333;line-height:1.6;">
                Based on what you told us, your business is missing approximately
                <strong style="color:#e53e3e;">${estimated_missed_leads} leads per month</strong> —
                that's roughly <strong style="color:#e53e3e;">$${Number(estimated_monthly_loss).toLocaleString()}/month</strong>
                in lost revenue walking right out the door.
              </p>

              <!-- Stats callout -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-left:4px solid #e53e3e;border-radius:4px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:50%;text-align:center;padding:8px;">
                          <div style="font-size:32px;font-weight:700;color:#e53e3e;">${estimated_missed_leads}</div>
                          <div style="font-size:13px;color:#666;margin-top:4px;">missed leads / mo</div>
                        </td>
                        <td style="width:50%;text-align:center;padding:8px;border-left:1px solid #fed7d7;">
                          <div style="font-size:32px;font-weight:700;color:#e53e3e;">$${Number(estimated_monthly_loss).toLocaleString()}</div>
                          <div style="font-size:13px;color:#666;margin-top:4px;">lost revenue / mo</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.6;">
                Autovyne deploys an AI chatbot and voice receptionist that answers every call and message —
                24/7, even on nights and weekends. It captures lead info, books appointments, and routes urgent
                requests to your team. Most clients recover their missed leads within the first week.
              </p>

              <p style="margin:0 0 32px;font-size:16px;color:#333;line-height:1.6;">
                Want to see your full 12-month ROI projection? Or just reply to this email to schedule
                a free 15-minute strategy call.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#0f0f0f;border-radius:6px;">
            <a href="https://autovyne.com/roi" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:-0.2px;">
                      See Your 12-Month ROI →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:15px;color:#555;line-height:1.6;">
                — The Autovyne Team<br>
                <span style="font-size:13px;color:#999;">Reply to this email or visit
          <a href="https://autovyne.com" style="color:#0f0f0f;">autovyne.com</a>
                  to learn more.</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;background:#f5f5f5;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#999;text-align:center;">
          You're receiving this because you submitted a lead audit at autovyne.com.<br>
                This is a one-time results email — no ongoing emails unless you reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a personalized auto-reply to a prospect with their audit results.
 * Uses Polsia email proxy (POLSIA_API_KEY). Skips silently if:
 *   - lead.email is missing
 *   - same business_name sent an auto-reply within the last 24 hours
 *   - POLSIA_API_KEY not set
 */
async function sendAutoReply(lead) {
  const { email, business_name, id } = lead;

  if (!email) {
    console.log(`[email] Auto-reply skipped for lead ${id} — no email provided`);
    return;
  }

  const apiKey = process.env.POLSIA_API_KEY;
  if (!apiKey) {
    console.warn('[email] Auto-reply skipped — POLSIA_API_KEY not set');
    return;
  }

  // 24h dedup check
  const dedupKey = (business_name || '').toLowerCase().trim();
  const lastSent = autoReplySentAt.get(dedupKey);
  if (lastSent && Date.now() - lastSent < AUTO_REPLY_COOLDOWN_MS) {
    console.log(`[email] Auto-reply skipped for lead ${id} — sent to "${business_name}" within 24h`);
    return;
  }

  // Register contact before sending so it gets known-contact treatment
  try {
    await fetch('https://polsia.com/api/proxy/email/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        name: business_name,
        source: 'contact_form',
      }),
    });
  } catch (err) {
    // Non-fatal — proceed with send even if contact registration fails
    console.warn('[email] Contact registration failed:', err.message);
  }

  const subject = `${escapeHtml(business_name)} — Your Free Lead Audit Results`;
  const plainText = `Hi ${business_name} team,\n\nBased on what you told us, your business is missing approximately ${lead.estimated_missed_leads} leads per month — that's roughly $${Number(lead.estimated_monthly_loss).toLocaleString()}/month in lost revenue.\n\nAutovyne deploys an AI chatbot and voice receptionist that answers every call and message 24/7, captures lead info, books appointments, and routes urgent requests to your team.\n\nReply to this email to schedule a free 15-minute strategy call, or visit https://autovyne.com/roi to see your full 12-month ROI projection.\n\n— The Autovyne Team`;

  try {
    const res = await fetch('https://polsia.com/api/proxy/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: email,
        subject,
        body: plainText,
        html: buildAutoReplyHtml(lead),
      }),
    });

    if (res.ok) {
      autoReplySentAt.set(dedupKey, Date.now());
      console.log(`[email] Auto-reply sent to ${email} for lead ${id}`);
    } else {
      const body = await res.text();
      console.error(`[email] Auto-reply failed for lead ${id}: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`[email] Auto-reply error for lead ${id}:`, err.message);
  }
}

module.exports = { sendLeadNotification, sendAutoReply };
