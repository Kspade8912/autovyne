const { fetchJson } = require('../lib/http');

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const content = response?.output?.flatMap(item => item.content || []) || [];
  return content.find(item => item.type === 'output_text')?.text || '';
}

async function qualifyLead(lead) {
  if (!isConfigured()) return null;

  const response = await fetchJson('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      store: false,
      max_output_tokens: 500,
      instructions: [
        'You qualify inbound leads for Autovyne, an AI automation agency for local businesses.',
        'Return only compact JSON with keys: priority, pain_summary, recommended_next_action, call_opener.',
        'priority must be high, medium, or low. Use only facts supplied in the lead.',
      ].join(' '),
      input: JSON.stringify({
        business_name: lead.business_name,
        industry: lead.industry,
        website_url: lead.website_url,
        monthly_call_volume: lead.monthly_call_volume,
        miss_rate_pct: lead.miss_rate_pct,
        estimated_missed_leads: lead.estimated_missed_leads,
        estimated_monthly_loss: lead.estimated_monthly_loss,
      }),
    }),
  }, 15000);

  const output = extractOutputText(response).trim();
  if (!output) return null;

  try {
    return JSON.parse(output.replace(/^```json\s*|\s*```$/g, ''));
  } catch (_error) {
    return { priority: 'medium', pain_summary: output.slice(0, 1000) };
  }
}

module.exports = { isConfigured, qualifyLead };
