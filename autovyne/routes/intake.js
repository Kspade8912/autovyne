/**
 * routes/intake.js
 * Owns: GET /intake (form page), POST /intake (submit + redirect to results),
 *       GET /results/:id (personalized ROI preview page).
 * Does NOT own: DB query logic (db/submissions.js), HTML templates (views/).
 */
const { Router } = require('express');
const { createSubmission } = require('../db/submissions');
const { sanitizeString, validateSubmission } = require('../lib/security');

const router = Router();

// Show the intake form
router.get('/', (_req, res) => {
  res.render('intake', {
    error: null,
    seo: {
      title: 'Get Your Free AI Automation Audit — Autovyne',
      description: 'Tell us about your business. We calculate your missed revenue and show you exactly how AI automation fixes it. Free, takes 2 minutes.',
      ogTitle: 'Get Your Free AI Automation Audit — Autovyne',
      ogDescription: 'Tell us about your business. We calculate exactly how much revenue you lose to missed calls — and show how AI automation recovers it.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.polsia.app/intake',
      canonical: 'https://autovyne.polsia.app/intake',
    },
  });
});

// Submit the intake form
router.post('/', async (req, res) => {
  // Bot/spam protection: honeypot + min-submit-time check
  const botCheck = validateSubmission(req, { honeypotField: '_honey', minSubmitMs: 3000 });
  if (botCheck) {
    // Silent fake-success — don't tell bots they were rejected
    return res.redirect('/results/0');
  }

  const {
    business_name,
    industry,
    phone,
    current_tools,
    monthly_calls,
    missed_calls_pct,
  } = req.body;

  // Sanitize inputs
  const sanitized = {
    businessName: sanitizeString(business_name),
    industry: sanitizeString(industry),
    phone: phone ? sanitizeString(phone) : '',
    currentTools: current_tools ? sanitizeString(current_tools) : '',
    monthlyCalls: parseInt(monthly_calls, 10),
    missedCallsPct: parseInt(missed_calls_pct, 10),
  };

  // Basic server-side validation
  if (!sanitized.businessName || !sanitized.industry || !sanitized.monthlyCalls || !sanitized.missedCallsPct) {
    return res.render('intake', { error: 'Please fill in all required fields.' });
  }

  if (isNaN(sanitized.monthlyCalls) || sanitized.monthlyCalls < 1 ||
      isNaN(sanitized.missedCallsPct) || sanitized.missedCallsPct < 1 || sanitized.missedCallsPct > 100) {
    return res.render('intake', { error: 'Please enter valid numbers for call volume and missed call %.' });
  }

  try {
    const submission = await createSubmission(sanitized);
    res.redirect(`/results/${submission.id}`);
  } catch (err) {
    console.error('[intake] POST error:', err.message);
    res.render('intake', { error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;