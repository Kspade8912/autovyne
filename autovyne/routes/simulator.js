// routes/simulator.js — GET /simulator page
const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.render('simulator', {
    activePage: 'simulator',
    seo: {
      title: 'Lead/Revenue Simulator — Autovyne',
      description: 'Simulate 12 months of business — see missed calls, lost leads, and revenue recovered with AI automation.',
      ogTitle: 'Lead/Revenue Simulator — Autovyne',
      ogDescription: 'Simulate 12 months of your business and see exactly how much revenue AI automation recovers.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.polsia.app/simulator',
      canonical: 'https://autovyne.polsia.app/simulator',
    },
  });
});

module.exports = router;