const assert = require('assert');
const {
  compactIndustryProfile,
  getIndustryProfile,
  normalizeIndustry,
} = require('./lib/industry-ai-profiles');

assert.equal(normalizeIndustry('HVAC'), 'hvac');
assert.equal(normalizeIndustry('plumbing'), 'hvac');
assert.equal(normalizeIndustry('hair-and-beauty'), 'beauty');
assert.equal(normalizeIndustry('dental'), 'medical');
assert.equal(normalizeIndustry('not-a-real-industry'), 'other');

const hvac = compactIndustryProfile('hvac');
assert.equal(hvac.defining_trait, 'Urgency-first dispatcher');
assert.ok(hvac.discovery_questions.length >= 2);
assert.ok(hvac.escalation_rule.includes('emergency'));

const restaurant = getIndustryProfile('restaurants-and-hospitality');
assert.equal(restaurant.key, 'restaurant');
assert.equal(restaurant.definingTrait, 'Reservation and guest-experience concierge');

console.log('Industry AI profile smoke test passed.');
