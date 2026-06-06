const { Router } = require('express');

const router = Router();
const ogImage = 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg';

function renderLegal(res, page, title, description) {
  res.render('legal', {
    page,
    seo: {
      title: `${title} - Autovyne`,
      description,
      ogTitle: `${title} - Autovyne`,
      ogDescription: description,
      ogImage,
      ogUrl: `https://autovyne.com/${page}`,
      canonical: `https://autovyne.com/${page}`,
    },
  });
}

router.get('/privacy', (_req, res) => renderLegal(
  res,
  'privacy',
  'Privacy Policy',
  'Learn how Autovyne collects, uses, and protects business, messaging, and AI automation data.'
));

router.get('/terms', (_req, res) => renderLegal(
  res,
  'terms',
  'Terms of Service',
  'Review the terms that apply when using Autovyne AI automation, messaging, and missed-call follow-up services.'
));

router.get('/sms-terms', (_req, res) => renderLegal(
  res,
  'sms-terms',
  'SMS Terms',
  'Review the terms for Autovyne SMS Alerts & Automation, including opt-out and help instructions.'
));

module.exports = router;
