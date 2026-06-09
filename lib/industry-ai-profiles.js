const INDUSTRY_AI_PROFILES = {
  hvac: {
    label: 'HVAC / Plumbing / Electric',
    aliases: ['plumbing', 'electric', 'electrical', 'home-services', 'home services'],
    definingTrait: 'Urgency-first dispatcher',
    workflowFocus: 'Prioritize emergency calls, after-hours capture, booking, and fast technician handoff.',
    callOpenerAngle: 'missed emergency calls and booked service jobs',
    discoveryQuestions: [
      'How many calls come in after hours or while techs are on jobs?',
      'What happens today when an urgent repair call is missed?',
    ],
    escalationRule: 'Escalate emergency, no-heat/no-cool, active leak, electrical safety, or same-day dispatch requests.',
  },
  contractors: {
    label: 'Contractors',
    aliases: ['roofing', 'roofer', 'construction', 'remodeling'],
    definingTrait: 'Estimate-to-job coordinator',
    workflowFocus: 'Capture project details, qualify urgency and budget, schedule estimates, and keep quote follow-up moving.',
    callOpenerAngle: 'missed estimate requests and slow quote follow-up',
    discoveryQuestions: [
      'How are new estimate requests tracked from first call to booked walkthrough?',
      'How often do quotes stall because follow-up is manual?',
    ],
    escalationRule: 'Escalate active damage, safety risk, insurance deadline, or high-value project requests.',
  },
  auto: {
    label: 'Towing / Automotive',
    aliases: ['automotive', 'auto repair', 'towing', 'detailing'],
    definingTrait: 'Fast triage and appointment router',
    workflowFocus: 'Separate urgent tow/repair needs from appointment requests and route each to the right next step.',
    callOpenerAngle: 'missed service calls, tow requests, and appointment bookings',
    discoveryQuestions: [
      'What happens when calls come in while the shop is busy or trucks are out?',
      'Which calls need immediate dispatch versus a scheduled service appointment?',
    ],
    escalationRule: 'Escalate roadside emergencies, stranded drivers, safety issues, or same-day repair requests.',
  },
  restaurant: {
    label: 'Restaurants / Hospitality',
    aliases: ['restaurants-and-hospitality', 'hospitality', 'food', 'restaurant / food'],
    definingTrait: 'Reservation and guest-experience concierge',
    workflowFocus: 'Handle reservations, event inquiries, catering, missed calls during rushes, and guest follow-up.',
    callOpenerAngle: 'missed reservations, event inquiries, and catering opportunities',
    discoveryQuestions: [
      'How many calls are missed during lunch or dinner rush?',
      'Do private event or catering inquiries get followed up consistently?',
    ],
    escalationRule: 'Escalate large party, private event, catering, complaint, or manager-request situations.',
  },
  medical: {
    label: 'Medical / Dental',
    aliases: ['dental', 'medical-and-dental', 'healthcare', 'dentist'],
    definingTrait: 'Careful patient-intake assistant',
    workflowFocus: 'Capture patient intent, route scheduling requests, avoid medical advice, and escalate urgent symptoms.',
    callOpenerAngle: 'missed new-patient calls and appointment requests',
    discoveryQuestions: [
      'How are new patient calls handled when the front desk is busy?',
      'What appointment types should be escalated instead of handled automatically?',
    ],
    escalationRule: 'Escalate urgent symptoms, pain, emergencies, medication questions, diagnosis requests, or clinical advice.',
  },
  beauty: {
    label: 'Hair / Beauty',
    aliases: ['salon', 'spa', 'aesthetics', 'hair-and-beauty'],
    definingTrait: 'Booking and rebooking stylist',
    workflowFocus: 'Book appointments, manage waitlists, follow up on missed calls, and support repeat client retention.',
    callOpenerAngle: 'missed bookings, cancellations, and repeat-client follow-up',
    discoveryQuestions: [
      'How are calls handled when stylists are with clients?',
      'Do missed calls get rebooked or placed on a waitlist automatically?',
    ],
    escalationRule: 'Escalate complaints, refunds, allergic reactions, urgent scheduling conflicts, or owner-request items.',
  },
  legal: {
    label: 'Legal / Law Firm',
    aliases: ['law', 'law firm', 'attorney'],
    definingTrait: 'Careful intake screener',
    workflowFocus: 'Capture matter type, urgency, contact details, and route to human review without legal advice.',
    callOpenerAngle: 'missed consultations and intake delays',
    discoveryQuestions: [
      'Which matter types are highest value for your firm?',
      'How quickly do new consultation requests get routed today?',
    ],
    escalationRule: 'Escalate deadlines, court dates, emergencies, conflict questions, or requests for legal advice.',
  },
  fitness: {
    label: 'Gym / Fitness Studio',
    aliases: ['gym', 'fitness studio', 'wellness'],
    definingTrait: 'Membership and class-growth assistant',
    workflowFocus: 'Capture trial requests, membership questions, class bookings, and follow-up for interested prospects.',
    callOpenerAngle: 'missed membership inquiries and trial bookings',
    discoveryQuestions: [
      'How are trial class or membership inquiries followed up today?',
      'What usually causes interested prospects to fall through?',
    ],
    escalationRule: 'Escalate injury, cancellation disputes, billing issues, or trainer-specific concerns.',
  },
  realestate: {
    label: 'Real Estate',
    aliases: ['real estate', 'realtor', 'broker'],
    definingTrait: 'Lead response and showing coordinator',
    workflowFocus: 'Respond quickly to buyer/seller inquiries, capture property intent, and route hot leads to an agent.',
    callOpenerAngle: 'missed buyer/seller leads and slow speed-to-lead',
    discoveryQuestions: [
      'How fast do new buyer or seller leads get a real response?',
      'Which lead sources are most valuable but easiest to miss?',
    ],
    escalationRule: 'Escalate ready-to-list sellers, urgent showings, offer questions, or financing-sensitive conversations.',
  },
  other: {
    label: 'Other Local Business',
    aliases: ['general', 'other local business'],
    definingTrait: 'Local-business lead capture assistant',
    workflowFocus: 'Capture missed calls, qualify intent, route urgent items, and create a clear follow-up path.',
    callOpenerAngle: 'missed calls and slow follow-up',
    discoveryQuestions: [
      'What kind of missed inquiry costs the business the most?',
      'What should happen after a new lead comes in?',
    ],
    escalationRule: 'Escalate urgent customer issues, billing concerns, complaints, or anything outside approved scripts.',
  },
};

function normalizeIndustry(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean) return 'other';
  if (INDUSTRY_AI_PROFILES[clean]) return clean;
  return Object.entries(INDUSTRY_AI_PROFILES).find(([, profile]) => (
    profile.aliases || []
  ).includes(clean))?.[0] || 'other';
}

function getIndustryProfile(value) {
  const key = normalizeIndustry(value);
  return { key, ...INDUSTRY_AI_PROFILES[key] };
}

function compactIndustryProfile(value) {
  const profile = getIndustryProfile(value);
  return {
    key: profile.key,
    label: profile.label,
    defining_trait: profile.definingTrait,
    workflow_focus: profile.workflowFocus,
    call_opener_angle: profile.callOpenerAngle,
    discovery_questions: profile.discoveryQuestions,
    escalation_rule: profile.escalationRule,
  };
}

module.exports = {
  compactIndustryProfile,
  getIndustryProfile,
  INDUSTRY_AI_PROFILES,
  normalizeIndustry,
};
