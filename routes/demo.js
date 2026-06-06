// routes/demo.js - GET /demo: unified ROI calculator and live business simulator.
const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.render('demo', {
    activePage: 'demo',
    seo: {
      title: 'ROI Calculator + Live Demo - Autovyne',
      description: 'Calculate missed-call revenue, then watch a live year-in-the-business demo showing how Autovyne AI automation recovers leads.',
      ogTitle: 'ROI Calculator + Live Demo - Autovyne',
      ogDescription: 'Estimate revenue at risk and watch Autovyne AI calling, SMS follow-up, and CRM automation recover missed leads.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.com/demo',
      canonical: 'https://autovyne.com/demo',
    },
  });
});

module.exports = router;
