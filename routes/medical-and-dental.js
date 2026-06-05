/**
 * routes/medical-and-dental.js
 * Owns: GET /medical-and-dental — Medical & Dental vertical landing page with ROI calculator.
 * Does NOT own: Database, email, or other routes.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('medical-and-dental', {
    seo: {
      title: 'Medical & Dental AI Automation — Capture Every New Patient | Autovyne',
      description: 'Medical practices miss 30% of calls while with patients. Autovyne captures every inquiry, schedules appointments, and reduces no-shows.',
      ogTitle: 'Medical & Dental AI Automation — Capture Every Patient | Autovyne',
      ogDescription: 'Medical practices miss 30% of calls while with patients. Autovyne answers every call, books new patients, and reduces no-shows.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
    ogUrl: 'https://autovyne.com/medical-and-dental',
    canonical: 'https://autovyne.com/medical-and-dental',
    },
  });
});

module.exports = router;
