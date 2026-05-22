/**
 * routes/roi.js
 * Owns: GET /roi — Enhanced ROI Calculator page.
 * Does NOT own: Database, email, or other routes.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('roi', {
    seo: {
      title: 'ROI Calculator — See Exactly How Much Revenue AI Automation Recovers | Autovyne',
      description: 'Calculate exactly how much revenue you lose to missed leads. See your 12-month projection, breakeven point, and ROI — for your industry.',
      ogTitle: 'ROI Calculator — See Your 12-Month AI Revenue Recovery',
      ogDescription: 'Calculate exactly how much revenue you lose to missed leads. 12-month projection, breakeven point, and ROI — free.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.polsia.app/roi',
      canonical: 'https://autovyne.polsia.app/roi',
    },
  });
});

module.exports = router;