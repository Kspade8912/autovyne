# Autovyne AI Agent Operating System

This playbook keeps prospecting, outreach, and follow-up agents aligned around one lead record and one next action.

## Shared Lead Stages

Every agent must read and update the same stage:

`new -> researched -> approved_for_outreach -> contacted -> replied -> qualified -> booked -> won/lost`

Required lead fields:

- `business_name`, `industry`, `website_url`, `contact_name`
- `email`, `phone`, `source`
- `stage`, `owner`, `priority`, `last_contacted_at`, `next_action_at`
- `pain_summary`, `personalization_note`, `estimated_monthly_loss`
- `do_not_contact`, `consent_status`, `notes`

## Agent Lineup

### 1. Research Agent

Finds local businesses that match the target industries and creates a short factual brief. It does not contact anyone.

Output: researched lead, website evidence, likely pain point, and confidence score.

### 2. Qualification Agent

Scores fit using industry, likely call volume, missed-call exposure, service area, and ability to benefit from Autovyne.

Output: priority `high`, `medium`, or `low`, plus a one-sentence reason.

### 3. Personalization Agent

Creates a truthful opening line and a short value hypothesis based only on verified research.

Output: personalization note and recommended channel. Never invent customer facts.

### 4. Outreach Drafting Agent

Drafts one email, one voicemail script, and one call opener. It may only use leads in `approved_for_outreach`.

Output: drafts ready for human review. It does not send or dial.

### 5. Human Approval Gate

Confirms the lead is appropriate to contact, checks suppression and consent status, and approves the message or call.

Output: approved outreach or rejection with reason.

### 6. Calling Assistant

Prepares the rep before a call: pain summary, likely objection, two discovery questions, and the best next step.

Output: call brief. Automated dialing stays disabled until calling compliance and vendor configuration are complete.

### 7. Follow-Up Agent

Schedules helpful, low-pressure follow-up based on the reply or call outcome. Stops immediately when `do_not_contact` is true.

Output: next action and draft follow-up.

### 8. Pipeline Manager

Checks for stalled leads, duplicate outreach, missing next actions, and booked meetings that need preparation.

Output: daily action list and pipeline summary.

## Non-Negotiable Handoff Rules

1. Only the Pipeline Manager changes ownership.
2. No agent contacts a lead unless the stage is `approved_for_outreach`.
3. Every contact attempt sets `last_contacted_at` and `next_action_at`.
4. Any opt-out sets `do_not_contact = true` immediately and cancels future actions.
5. One lead can have only one pending outbound action.
6. Agents must use verified facts and must not claim guaranteed revenue.
7. Calls and messages require human approval until consent, suppression-list, and calling-rule checks are automated and reviewed.

## Daily Run

1. Research Agent adds a small batch of qualified local businesses.
2. Qualification Agent scores and removes poor-fit leads.
3. Personalization Agent prepares factual notes.
4. Human reviews and moves approved leads to `approved_for_outreach`.
5. Outreach Drafting Agent prepares the day’s messages and call briefs.
6. Human sends messages and places calls.
7. Follow-Up Agent records outcomes and next actions.
8. Pipeline Manager produces an end-of-day summary.

## First Promotion Focus

Start with one vertical and one offer:

- Vertical: HVAC and home services
- Offer: paid signup with missed-call revenue analysis during onboarding
- Primary CTA: `/demo`
- Conversion CTA: `/signup`
- Promise: show the opportunity using the prospect’s numbers, without guaranteeing results

Measure: researched leads, approvals, contact attempts, replies, qualified replies, booked calls, and closed clients.

## Shared Industry AI Pattern

Every industry AI uses the same Autovyne operating pattern:

1. Capture the lead or customer request.
2. Identify missed-call, follow-up, booking, or CRM risk.
3. Apply the industry profile for language, urgency, and escalation.
4. Produce a short next action that a human can review.
5. Never send SMS unless consent proof exists.
6. Never give medical, legal, financial, or emergency advice.

Industry-specific defining traits:

- **HVAC / Plumbing / Electric**: urgency-first dispatcher for emergency service calls and fast technician handoff.
- **Contractors**: estimate-to-job coordinator for project details, walkthroughs, and quote follow-up.
- **Towing / Automotive**: fast triage and appointment router for urgent tow/repair versus scheduled service.
- **Restaurants / Hospitality**: reservation and guest-experience concierge for bookings, events, catering, and rush-hour missed calls.
- **Medical / Dental**: careful patient-intake assistant that routes scheduling and escalates clinical or urgent requests.
- **Hair / Beauty**: booking and rebooking stylist for appointments, waitlists, cancellations, and retention.
- **Legal / Law Firm**: careful intake screener that captures matter type and routes to human review without legal advice.
- **Gym / Fitness Studio**: membership and class-growth assistant for trials, membership questions, and class bookings.
- **Real Estate**: lead response and showing coordinator for buyer/seller speed-to-lead.
- **Other Local Business**: general local-business lead capture assistant.

If OpenAI is temporarily at capacity, Autovyne should still save the lead/account, continue CRM/n8n handoff where possible, and mark the AI brief as fallback/pending instead of blocking operations.

## Tomorrow Demo Account Checklist

1. Create a demo account in `/admin/accounts`.
2. Choose the target industry profile, starting with HVAC unless the prospect is in another vertical.
3. Use SMB Bundle or Professional so the demo shows the full stack.
4. Set status to `setup` first, then use one-click account operations to show progress.
5. Add visible customer updates: payment confirmed, onboarding started, AI calling connected, CRM connected, workflow connected.
6. Open `/portal` with the demo email and portal password/access code to confirm the customer view.
7. Use `/admin/launch` and `/admin/integrations` before cold calling.
8. During calls, use the industry trait, two discovery questions, and the no-guarantee ROI demo at `/demo`.
