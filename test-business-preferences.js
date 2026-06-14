const assert = require('assert');
const {
  buildRecommendation,
  mergePreferences,
  preferenceSummary,
  preferencesFromBody,
} = require('./lib/business-preferences');

const preferences = preferencesFromBody({
  service_needs: ['missed_calls', 'calendar_updates', 'not-real'],
  update_channels: ['portal', 'email'],
  lead_channels: ['portal', 'sms'],
  booking_channels: ['portal', 'calendar'],
  calendar_provider: 'google',
  calendar_sync_preference: 'send_invites',
  followup_style: 'appointment_first',
  followup_approval_mode: 'review_first',
  followup_stop_when: 'booked',
  summary_frequency: 'daily',
  consultation_requested: 'true',
  consultation_notes: 'Need booking help.',
  plan: 'professional',
  industry: 'hvac',
});

assert.equal(preferences.consultation.requested, true);
assert.deepEqual(preferences.consultation.needs, ['missed_calls', 'calendar_updates']);
assert.deepEqual(preferences.communication.update_channels, ['portal', 'email']);
assert.deepEqual(preferences.communication.lead_channels, ['portal', 'sms']);
assert.deepEqual(preferences.communication.booking_channels, ['portal', 'calendar']);
assert.equal(preferences.calendar.provider, 'google');
assert.equal(preferences.followup.style, 'appointment_first');
assert(preferences.consultation.recommendation.summary.includes('Missed-call follow-up'));

const recommendation = buildRecommendation({ needs: ['lead_tracker', 'appointment_booking'] });
assert.equal(recommendation.plan, 'professional');
assert(recommendation.services.includes('crm_sync'));
assert(recommendation.services.includes('n8n_workflows'));

const mismatch = buildRecommendation({ needs: ['missed_calls'], plan: 'enterprise' });
assert.equal(mismatch.plan, 'starter');
assert.equal(mismatch.selected_plan, 'enterprise');
assert(mismatch.summary.includes('selected plan is enterprise'));

const merged = mergePreferences(
  { consultation: { requested: true, notes: 'Keep this.' }, communication: { update_channels: ['portal'] } },
  { communication: { update_channels: ['portal', 'email'] }, calendar: { provider: 'microsoft' } }
);
assert.equal(merged.consultation.notes, 'Keep this.');
assert.deepEqual(merged.communication.update_channels, ['portal', 'email']);
assert.equal(merged.calendar.provider, 'microsoft');

const summary = preferenceSummary(preferences);
assert.equal(summary.channels, 'Portal only, Email updates');
assert.equal(summary.calendar, 'Google Calendar');
assert.equal(summary.followup, 'Booking-focused');

console.log('Business preferences smoke test passed.');
