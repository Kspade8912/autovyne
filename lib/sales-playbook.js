const SIMPLE_SALES_FLOW = [
  'Open with the missed-call problem, not the product.',
  'Ask one qualifying question about missed calls or slow follow-up.',
  'Offer the ROI + live demo as the next step.',
  'If interested, send the signup link and explain payment -> onboarding -> portal activation.',
  'After signup, use the onboarding checklist and customer portal to keep the owner informed.',
];

const OFFER_POINTS = [
  {
    label: 'What Autovyne does',
    detail: 'Autovyne helps local businesses recover missed-call and slow-follow-up revenue using AI calling, consent-aware SMS, CRM sync, and workflow automation.',
  },
  {
    label: 'What customers buy',
    detail: 'A monthly managed automation subscription. Payment activates the portal and starts onboarding; services are turned on after setup and review.',
  },
  {
    label: 'What not to promise',
    detail: 'Do not promise guaranteed revenue, guaranteed bookings, guaranteed compliance, or perfect AI. Use estimates and say results depend on setup, traffic, consent, and customer operations.',
  },
];

const SCRIPT_BLOCKS = [
  {
    title: '15-second opener',
    body: 'Hi, this is Kwaun with Autovyne. Quick question: when your team misses a call or gets busy, how fast does someone follow up with that lead?',
  },
  {
    title: '30-second pitch',
    body: 'Autovyne helps local businesses catch missed calls, follow up faster, and keep leads organized without making the owner manage a bunch of apps. We use AI calling, consent-aware SMS, CRM updates, and a simple portal so you can see what is happening.',
  },
  {
    title: 'Demo close',
    body: 'I can show you a quick live demo that estimates what missed calls may be costing and what an automated follow-up workflow could look like. If it does not look useful, no pressure.',
  },
  {
    title: 'Voicemail',
    body: 'Hi, this is Kwaun with Autovyne. I was calling about missed-call follow-up for your business. I have a quick demo that shows how much revenue can slip through when calls are missed or follow-up is slow. I will send the link if I have your email, or you can visit the Autovyne demo page.',
  },
  {
    title: 'Not interested response',
    body: 'No problem. Before I let you go, is missed-call follow-up already handled well on your end, or is it just not a priority right now?',
  },
  {
    title: 'Price objection',
    body: 'That makes sense. The reason I start with the demo is to see whether the missed-call gap is larger than the monthly cost. If the numbers do not support it, I would not push you into it.',
  },
  {
    title: 'Follow-up email',
    body: 'Subject: quick missed-call demo for [Business Name]\n\nHi [Name],\n\nGood speaking with you. Here is the Autovyne demo we talked about: [Demo Link]\n\nIt shows how missed calls and slow follow-up can affect local businesses, then shows how AI calling, SMS follow-up, CRM sync, and workflow automation can help keep leads from slipping away.\n\nIf it looks useful, the next step is signup, monthly payment, onboarding, then portal activation.\n\nKwaun\nAutovyne',
  },
  {
    title: 'SMS follow-up only with consent',
    body: 'Autovyne follow-up: here is the demo link we discussed: [Demo Link]. Reply STOP to opt out or HELP for help. Message/data rates may apply.',
  },
];

module.exports = {
  OFFER_POINTS,
  SCRIPT_BLOCKS,
  SIMPLE_SALES_FLOW,
};
