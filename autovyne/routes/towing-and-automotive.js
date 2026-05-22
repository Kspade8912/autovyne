/**
 * routes/towing-and-automotive.js
 * Owns: GET /towing-and-automotive — Towing & Automotive vertical landing page with ROI calculator.
 * Does NOT own: Database, email, or other routes.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('towing-and-automotive', {
    seo: {
      title: 'Towing & Auto AI Automation — Answer Every Dispatch Call | Autovyne',
      description: 'Towing companies lose calls to busy dispatchers and after-hours. Autovyne captures every dispatch request and dispatches drivers instantly.',
      ogTitle: 'Towing & Auto AI Automation — Answer Every Dispatch Call | Autovyne',
      ogDescription: 'Towing companies lose calls when all drivers are on dispatch. Autovyne answers every call and dispatches drivers automatically.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.polsia.app/towing-and-automotive',
      canonical: 'https://autovyne.polsia.app/towing-and-automotive',
    },
  });
});

module.exports = router;
