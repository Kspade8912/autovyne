/**
 * routes/hair-and-beauty.js
 * Owns: GET /hair-and-beauty — Hair & Beauty vertical landing page with ROI calculator.
 * Does NOT own: Database, email, or other routes.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('hair-and-beauty', {
    seo: {
      title: 'Hair & Beauty Salon AI Automation — Capture Every Booking | Autovyne',
      description: "Salons miss 25% of calls during appointments. Autovyne's AI handles every inquiry, books clients, and fills your calendar.",
      ogTitle: 'Hair & Beauty AI Automation — Never Miss a Booking | Autovyne',
      ogDescription: "Salons miss 25% of calls during busy hours. Autovyne's AI answers every call, books appointments, and fills your calendar 24/7.",
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
    ogUrl: 'https://autovyne.com/hair-and-beauty',
    canonical: 'https://autovyne.com/hair-and-beauty',
    },
  });
});

module.exports = router;
