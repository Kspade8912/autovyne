const { Router } = require('express');

const router = Router();

router.get('/', (_req, res) => {
  res.render('tutorial', {
    seo: {
      title: 'Autovyne Signup Tutorial',
      description: 'A step-by-step walkthrough showing new Autovyne customers how to sign up, complete onboarding, and use the client portal.',
      ogTitle: 'Autovyne Signup Tutorial',
      ogDescription: 'Watch the Autovyne signup flow from demo to payment, onboarding, and portal activation.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.com/tutorial',
      canonical: 'https://autovyne.com/tutorial',
    },
  });
});

module.exports = router;
