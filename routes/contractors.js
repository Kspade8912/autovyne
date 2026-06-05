/**
 * routes/contractors.js
 * Owns: GET /contractors — Contractors vertical landing page with ROI calculator.
 * Does NOT own: Database, email, or other routes.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('contractors', {
    seo: {
      title: 'Contractor AI Automation — Stop Missing Estimate Requests | Autovyne',
      description: 'Contractors lose 35% of estimate requests to missed calls on job sites. Autovyne captures every inquiry and schedules site visits.',
      ogTitle: 'Contractor AI Automation — Stop Missing Leads on Job Sites | Autovyne',
      ogDescription: 'Contractors miss 35% of calls while on job sites. Autovyne captures every lead, books site visits, and recovers lost contracts.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
    ogUrl: 'https://autovyne.com/contractors',
    canonical: 'https://autovyne.com/contractors',
    },
  });
});

module.exports = router;
