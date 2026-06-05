/**
 * routes/leads.js
 * Owns: GET /api/leads (list), POST /api/leads (create + email notification + auto-reply).
 * Does NOT own: DB queries (db/leads.js), email sending (services/email.js).
 */
const { Router } = require('express');
const { createLead, listLeads } = require('../db/leads');
const { sendLeadNotification, sendAutoReply } = require('../services/email');
const { createRateLimiter, sanitizeString, validateSubmission } = require('../lib/security');
const { logEvent } = require('../db/analytics');
const { processNewLead } = require('../services/integrations');

const router = Router();

// Stricter rate limit: 5 POST submissions per 15 min per IP
const submissionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many submissions. Please wait a few minutes.',
});

// GET /api/leads — list all leads (newest first), internal use only.
// Requires Authorization: Bearer <ADMIN_API_KEY> header.
router.get('/', (req, res, next) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    // ADMIN_API_KEY not configured — close the endpoint entirely
    return res.status(403).json({ error: 'Forbidden' });
  }
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}, async (_req, res) => {
  try {
    const leads = await listLeads({ limit: 100 });
    res.json({ leads, count: leads.length });
  } catch (err) {
    console.error('[leads] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// POST /api/leads — create a new lead, send internal notification, send prospect auto-reply
router.post('/', submissionLimiter, async (req, res) => {
  // Bot/spam protection: check honeypot + min submit time
  const botCheck = validateSubmission(req, { honeypotField: '_honey', minSubmitMs: 3000 });
  if (botCheck) {
    // Silently reject bots — return a fake success so they don't probe further
    return res.status(201).json({ lead: { id: 0 } });
  }

  const {
    business_name,
    industry,
    monthly_call_volume,
    miss_rate_pct,
    website_url,
    email,
    _honey, // honeypot — already checked above, strip it
  } = req.body;

  // Basic email format validation (optional field — skip if missing)
  const sanitizedEmail = email ? sanitizeString(email).toLowerCase() : null;
  const emailValid = !sanitizedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail);

  // Sanitize all inputs
  const sanitized = {
    businessName: sanitizeString(business_name),
    industry: sanitizeString(industry),
    monthlyCallVolume: parseInt(monthly_call_volume, 10),
    missRatePct: parseInt(miss_rate_pct, 10),
    websiteUrl: website_url ? sanitizeString(website_url) : null,
    email: emailValid ? sanitizedEmail : null,
  };

  // Validation
  if (!sanitized.businessName || !sanitized.industry || !sanitized.monthlyCallVolume || sanitized.missRatePct == null) {
    return res.status(400).json({ error: 'business_name, industry, monthly_call_volume, and miss_rate_pct are required' });
  }

  if (isNaN(sanitized.monthlyCallVolume) || sanitized.monthlyCallVolume < 0 ||
      isNaN(sanitized.missRatePct) || sanitized.missRatePct < 0 || sanitized.missRatePct > 100) {
    return res.status(400).json({ error: 'Invalid monthly_call_volume or miss_rate_pct' });
  }

  try {
    const lead = await createLead(sanitized);

    // Server-side analytics: always log form submissions (independent of client JS)
    logEvent({
      page: '/intake',
      eventType: 'submit',
      metadata: {
        business_name: sanitized.businessName,
        industry: sanitized.industry,
        lead_id: lead.id,
      },
      ipHash: null, // avoid double-counting — client-side already captures IP hash
      userAgent: req.headers['user-agent'] || null,
      referrer: req.headers['referer'] || null,
    }).catch(err => {
      console.error('[leads] Analytics log error:', err.message);
    });

    // Both emails fire-and-forget — never block the response
    sendLeadNotification(lead).catch(err => {
      console.error('[leads] Email notification error:', err.message);
    });
    sendAutoReply(lead).catch(err => {
      console.error('[leads] Auto-reply error:', err.message);
    });
    processNewLead(lead).catch(err => {
      console.error('[leads] Integration pipeline error:', err.message);
    });

    res.status(201).json({ lead });
  } catch (err) {
    console.error('[leads] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

module.exports = router;
