/**
 * routes/hvac.js
 * Owns: GET /hvac — HVAC-specific landing page with ROI calculator.
 * Does NOT own: Database, email, or other routes.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('hvac', {
    seo: {
      title: 'HVAC AI Automation — Stop Missing $7K/Month in Leads | Autovyne',
      description: "HVAC companies lose $7K/month to missed after-hours calls. Autovyne's AI answers every one, books appointments, and recovers lost revenue.",
      ogTitle: 'HVAC AI Automation — Stop Missing $7K/Month | Autovyne',
      ogDescription: "HVAC companies lose $7K/month to missed calls. Autovyne's AI voice receptionist answers every call, 24/7.",
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.polsia.app/hvac',
      canonical: 'https://autovyne.polsia.app/hvac',
    },
  });
});

module.exports = router;