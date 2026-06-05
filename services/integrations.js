const openai = require('./openai');
const hubspot = require('./hubspot');
const n8n = require('./n8n');

async function runStep(name, fn) {
  try {
    const result = await fn();
    return { name, status: result ? 'sent' : 'skipped' };
  } catch (error) {
    console.error(`[integrations] ${name} error:`, error.message);
    return { name, status: 'failed', error: error.message };
  }
}

async function processNewLead(lead) {
  let qualification = null;

  const openaiResult = await runStep('openai', async () => {
    qualification = await openai.qualifyLead(lead);
    return qualification;
  });

  const [hubspotResult, n8nResult] = await Promise.all([
    runStep('hubspot', () => hubspot.upsertLead(lead)),
    runStep('n8n', () => n8n.sendLeadEvent(lead, qualification)),
  ]);

  console.log('[integrations] lead processed:', lead.id, openaiResult.status, hubspotResult.status, n8nResult.status);
  return { qualification, steps: [openaiResult, hubspotResult, n8nResult] };
}

function getConfigurationStatus() {
  return {
    supabase: { configured: Boolean(process.env.DATABASE_URL) },
    openai: { configured: openai.isConfigured(), model: process.env.OPENAI_MODEL || 'gpt-5.4-mini' },
    hubspot: { configured: hubspot.isConfigured() },
    n8n: { configured: n8n.isConfigured() },
  };
}

module.exports = { processNewLead, getConfigurationStatus };
