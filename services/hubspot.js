const { fetchJson } = require('../lib/http');

function isConfigured() {
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
}

async function upsertLead(lead) {
  if (!isConfigured() || !lead.email) return null;

  const properties = {
    email: lead.email,
    company: lead.business_name,
    lifecyclestage: 'lead',
  };
  if (lead.website_url) properties.website = lead.website_url;
  if (lead.sms_consent && lead.phone) properties.phone = lead.phone;

  const response = await fetchJson('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [{
        id: lead.email,
        idProperty: 'email',
        properties,
      }],
    }),
  }, 15000);

  return response?.results?.[0] || response;
}

module.exports = { isConfigured, upsertLead };
