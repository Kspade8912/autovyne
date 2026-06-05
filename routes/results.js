/**
 * routes/results.js
 * Owns: GET /results/:id — personalized ROI preview page after intake form.
 * Does NOT own: DB query logic (db/leads.js), HTML templates (views/).
 */
const { Router } = require('express');
const { getLeadById } = require('../db/leads');

const router = Router();

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(404).render('404');

  try {
    const lead = await getLeadById(id);
    if (!lead) return res.status(404).render('404');
    res.render('results', {
      submission: lead,
      seo: {
        title: 'Your AI Automation Report — Autovyne',
        description: 'See exactly how much revenue your business loses to missed calls — and how AI automation recovers it.',
        ogTitle: 'Your AI Automation Report — Autovyne',
        ogDescription: 'See exactly how much revenue your business loses to missed calls — and how AI automation recovers it.',
        ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.com/results/' + id,
      canonical: 'https://autovyne.com/results/' + id,
      },
    });
  } catch (err) {
    console.error('[results] GET error:', err.message);
    res.status(500).render('intake', { error: 'Could not load your results. Please try again.' });
  }
});

module.exports = router;
