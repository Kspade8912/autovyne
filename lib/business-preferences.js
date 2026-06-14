const SERVICE_NEEDS = [
  {
    key: 'missed_calls',
    label: 'Missed-call follow-up',
    description: 'Catch callers who do not get answered the first time.',
    services: ['ai_calling', 'openai_qualification'],
  },
  {
    key: 'text_updates',
    label: 'Text message updates',
    description: 'Send consent-based updates and follow-up by text.',
    services: ['sms_followup'],
  },
  {
    key: 'appointment_booking',
    label: 'Appointment booking help',
    description: 'Route interested callers toward booking, callbacks, or reminders.',
    services: ['n8n_workflows'],
  },
  {
    key: 'lead_tracker',
    label: 'Lead tracker',
    description: 'Keep customer and lead activity organized in one pipeline.',
    services: ['crm_sync'],
  },
  {
    key: 'owner_alerts',
    label: 'Owner alerts',
    description: 'Notify the business owner when a lead needs attention.',
    services: ['n8n_workflows'],
  },
  {
    key: 'customer_questions',
    label: 'Customer question handling',
    description: 'Help route common questions and review requests.',
    services: ['openai_qualification'],
  },
  {
    key: 'calendar_updates',
    label: 'Calendar updates',
    description: 'Prepare appointment details for Google, Microsoft, Apple, or portal calendar use.',
    services: ['n8n_workflows'],
  },
  {
    key: 'review_followup',
    label: 'Review and win-back follow-up',
    description: 'Create structured follow-up for reviews, no-shows, and quiet leads.',
    services: ['sms_followup', 'n8n_workflows'],
  },
];

const UPDATE_CHANNELS = [
  { key: 'portal', label: 'Portal only' },
  { key: 'email', label: 'Email updates' },
  { key: 'sms', label: 'Text updates' },
];

const CALENDAR_PROVIDERS = [
  { key: 'portal', label: 'Autovyne portal calendar' },
  { key: 'google', label: 'Google Calendar' },
  { key: 'microsoft', label: 'Microsoft Outlook / 365' },
  { key: 'apple', label: 'Apple Calendar' },
  { key: 'other', label: 'Other calendar app' },
];

const FOLLOWUP_STYLES = [
  { key: 'speed_first', label: 'Fast response first' },
  { key: 'appointment_first', label: 'Booking-focused' },
  { key: 'owner_review', label: 'Owner reviews before changes' },
  { key: 'gentle_nurture', label: 'Gentle follow-up' },
];

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function allowedKeys(values, allowed, fallback = []) {
  const set = new Set(allowed.map(item => item.key));
  const clean = toArray(values).map(value => String(value || '').trim()).filter(value => set.has(value));
  return clean.length ? Array.from(new Set(clean)) : fallback;
}

function serviceNeedByKey(key) {
  return SERVICE_NEEDS.find(item => item.key === key) || null;
}

function labelsFor(keys, source) {
  return allowedKeys(keys, source).map(key => source.find(item => item.key === key)?.label || key);
}

function recommendedPlanForNeeds(needKeys = []) {
  const needs = new Set(needKeys);
  if (needs.size >= 5 || needs.has('calendar_updates') || needs.has('review_followup')) return 'professional';
  if (needs.has('lead_tracker') && needs.has('appointment_booking')) return 'professional';
  if (needs.has('missed_calls') || needs.has('text_updates') || needs.has('lead_tracker')) return 'starter';
  return 'smb-bundle';
}

function servicesForNeeds(needKeys = []) {
  const services = new Set();
  needKeys.forEach(key => {
    const need = serviceNeedByKey(key);
    (need?.services || []).forEach(service => services.add(service));
  });
  return Array.from(services);
}

function buildRecommendation({ needs = [], plan = null, industry = null } = {}) {
  const cleanNeeds = allowedKeys(needs, SERVICE_NEEDS);
  const recommendedPlan = recommendedPlanForNeeds(cleanNeeds);
  const selectedPlan = plan || null;
  const needLabels = labelsFor(cleanNeeds, SERVICE_NEEDS);
  const serviceKeys = servicesForNeeds(cleanNeeds);
  const mainNeed = needLabels[0] || 'lead follow-up';
  const planNote = selectedPlan && selectedPlan !== recommendedPlan
    ? ` The selected plan is ${selectedPlan.replace('-', ' ')}, so Autovyne should review whether that plan is enough for the requested setup.`
    : '';
  const summary = cleanNeeds.length
    ? `Based on ${needLabels.join(', ')}, Autovyne should start with ${mainNeed.toLowerCase()} and build the account around ${recommendedPlan.replace('-', ' ')}-level support.`
    : `Autovyne should start with a consultation and missed-call audit, then recommend the right monthly setup for this ${industry || 'business'}.`;

  return {
    plan: recommendedPlan,
    selected_plan: selectedPlan,
    summary: `${summary}${planNote}`,
    needs: cleanNeeds,
    services: serviceKeys,
  };
}

function preferencesFromBody(body = {}) {
  const needs = allowedKeys(body.service_needs, SERVICE_NEEDS);
  const updateChannels = allowedKeys(body.update_channels, UPDATE_CHANNELS, ['portal']);
  const leadChannels = allowedKeys(body.lead_channels, UPDATE_CHANNELS, updateChannels);
  const bookingChannels = allowedKeys(body.booking_channels, [
    ...UPDATE_CHANNELS,
    { key: 'calendar', label: 'Calendar' },
  ], updateChannels.includes('email') ? ['portal', 'email'] : ['portal']);
  const calendarProvider = allowedKeys(body.calendar_provider, CALENDAR_PROVIDERS, ['portal'])[0];
  const followupStyle = allowedKeys(body.followup_style, FOLLOWUP_STYLES, ['owner_review'])[0];
  const consultationRequested = body.consultation_requested === 'true' || body.consultation_requested === true;

  return {
    consultation: {
      requested: consultationRequested,
      best_time: String(body.consultation_best_time || '').trim().slice(0, 180),
      notes: String(body.consultation_notes || '').trim().slice(0, 1000),
      needs,
      recommendation: buildRecommendation({ needs, plan: body.plan, industry: body.industry }),
    },
    communication: {
      update_channels: updateChannels,
      lead_channels: leadChannels,
      booking_channels: bookingChannels,
      summary_frequency: ['instant', 'daily', 'weekly'].includes(body.summary_frequency) ? body.summary_frequency : 'daily',
    },
    calendar: {
      provider: calendarProvider,
      provider_label: CALENDAR_PROVIDERS.find(item => item.key === calendarProvider)?.label || 'Autovyne portal calendar',
      sync_preference: ['portal_only', 'send_invites', 'connect_later'].includes(body.calendar_sync_preference)
        ? body.calendar_sync_preference
        : 'portal_only',
      timezone: String(body.calendar_timezone || '').trim().slice(0, 80),
    },
    followup: {
      style: followupStyle,
      style_label: FOLLOWUP_STYLES.find(item => item.key === followupStyle)?.label || 'Owner reviews before changes',
      approval_mode: ['review_first', 'approved_rules'].includes(body.followup_approval_mode)
        ? body.followup_approval_mode
        : 'review_first',
      stop_when: ['booked', 'owner_review', 'after_three_attempts'].includes(body.followup_stop_when)
        ? body.followup_stop_when
        : 'booked',
    },
  };
}

function mergePreferences(current = {}, updates = {}) {
  return {
    consultation: {
      ...(current.consultation || {}),
      ...(updates.consultation || {}),
    },
    communication: {
      ...(current.communication || {}),
      ...(updates.communication || {}),
    },
    calendar: {
      ...(current.calendar || {}),
      ...(updates.calendar || {}),
    },
    followup: {
      ...(current.followup || {}),
      ...(updates.followup || {}),
    },
  };
}

function preferenceSummary(preferences = {}) {
  const channels = labelsFor(preferences.communication?.update_channels || ['portal'], UPDATE_CHANNELS).join(', ');
  const needs = labelsFor(preferences.consultation?.needs || [], SERVICE_NEEDS).join(', ');
  return {
    channels: channels || 'Portal only',
    calendar: preferences.calendar?.provider_label || 'Autovyne portal calendar',
    followup: preferences.followup?.style_label || 'Owner reviews before changes',
    needs: needs || 'No consultation needs selected yet',
    recommendation: preferences.consultation?.recommendation?.summary || 'Recommendation appears after consultation needs are selected.',
  };
}

module.exports = {
  CALENDAR_PROVIDERS,
  FOLLOWUP_STYLES,
  SERVICE_NEEDS,
  UPDATE_CHANNELS,
  buildRecommendation,
  mergePreferences,
  preferenceSummary,
  preferencesFromBody,
};
