/**
 * routes/restaurants-and-hospitality.js
 * Owns: GET /restaurants-and-hospitality — Restaurants & Hospitality vertical landing page with ROI calculator.
 * Does NOT own: Database, email, or other routes.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('restaurants-and-hospitality', {
    seo: {
      title: 'Restaurant & Hospitality AI Automation — Fill Every Table | Autovyne',
      description: 'Restaurants miss reservations during dinner rush. Autovyne handles every call, books tables, and fills your seats — even at midnight.',
      ogTitle: 'Restaurant & Hospitality AI Automation — Fill Every Table | Autovyne',
      ogDescription: 'Restaurants miss reservations during dinner rush. Autovyne handles every call, books tables, and fills your seats 24/7.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
    ogUrl: 'https://autovyne.com/restaurants-and-hospitality',
    canonical: 'https://autovyne.com/restaurants-and-hospitality',
    },
  });
});

module.exports = router;
