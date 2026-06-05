// routes/demo.js — GET /demo: Live Business Simulator page
// Owns: rendering the /demo view. Does NOT own: data persistence, API calls.
const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.render('demo', {
    activePage: 'demo',
    seo: {
      title: 'Live Business Simulator — See AI Automation in Action | Autovyne',
      description: 'Watch a year of business unfold in 60 seconds — with and without AI automation. See exactly how much revenue Autovyne recovers.',
      ogTitle: 'Watch a Year of Revenue — With vs Without Autovyne',
      ogDescription: 'Watch a year of business unfold side by side — one business without AI, one with. Every missed call, every dollar recovered.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
    ogUrl: 'https://autovyne.com/demo',
    canonical: 'https://autovyne.com/demo',
    },
  });
});

module.exports = router;
