const { Router } = require('express');
const { createQuestion } = require('../db/questions');
const { createRateLimiter, sanitizeString, validateSubmission } = require('../lib/security');
const { recordSmsConsent } = require('../db/compliance');
const { SMS_CONSENT_TEXT, hasSmsConsent, getRequestIp } = require('../lib/sms-consent');
const { sendQuestionEvent } = require('../services/n8n');

const router = Router();
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5 });

function pageData(overrides = {}) {
  return {
    submitted: false,
    error: null,
    seo: {
      title: 'Ask Autovyne a Question',
      description: 'Submit a question about Autovyne AI automation, onboarding, integrations, or business workflows.',
      ogTitle: 'Ask Autovyne a Question',
      ogDescription: 'Tell us what you want to automate and the Autovyne team will follow up.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.com/questions',
      canonical: 'https://autovyne.com/questions',
    },
    ...overrides,
  };
}

router.get('/', (_req, res) => res.render('questions', pageData()));

router.post('/', limiter, async (req, res) => {
  if (validateSubmission(req, { honeypotField: '_honey', minSubmitMs: 3000 })) {
    return res.render('questions', pageData({ submitted: true }));
  }

  const email = sanitizeString(req.body.email || '').toLowerCase();
  const data = {
    name: sanitizeString(req.body.name),
    businessName: sanitizeString(req.body.business_name),
    email,
    phone: sanitizeString(req.body.phone),
    category: sanitizeString(req.body.category) || 'general',
    urgency: sanitizeString(req.body.urgency) || 'normal',
    contactPreference: sanitizeString(req.body.contact_preference) || 'email',
    question: sanitizeString(req.body.question),
    smsConsent: hasSmsConsent(req.body.sms_consent),
  };

  if (!data.name || !data.email || !data.question || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).render('questions', pageData({ error: 'Please provide your name, a valid email, and your question.' }));
  }

  try {
    const question = await createQuestion(data);
    await recordSmsConsent({
      phone: data.phone,
      consented: data.smsConsent,
      formSource: 'questions_form',
      sourceRecordType: 'question',
      sourceRecordId: question.id,
      ipAddress: getRequestIp(req),
      userAgent: req.headers['user-agent'] || null,
      consentText: SMS_CONSENT_TEXT,
    });
    sendQuestionEvent({ ...question, smsConsent: data.smsConsent }).catch(error => {
      console.error('[questions] n8n error:', error.message);
    });
    res.render('questions', pageData({ submitted: true }));
  } catch (error) {
    console.error('[questions] POST error:', error.message);
    res.status(500).render('questions', pageData({ error: 'Your question could not be saved. Please email kwaun.autovyne@gmail.com.' }));
  }
});

module.exports = router;
