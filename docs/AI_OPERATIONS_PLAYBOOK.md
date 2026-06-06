# Autovyne AI Operations Playbook

## Efficient Customer Flow

1. A business owner lands on Autovyne and uses the ROI + Live Demo page.
2. They submit an audit, question, or onboarding form.
3. Supabase stores the lead, question, SMS consent evidence, and account data.
4. OpenAI qualifies the lead and creates a simple next-action summary.
5. HubSpot stores the CRM contact and business context.
6. n8n receives the event and coordinates follow-up workflows.
7. Twilio sends SMS only when the consent checkbox was checked and recorded.
8. The customer sees a limited status view in `/portal`.
9. Autovyne manages all accounts from `/admin/accounts`.

## Customer Portal

Use `/admin/accounts` to create a customer account after a business signs up.

Give the customer:

- Portal URL: `/portal`
- Their email address
- Their access code

The customer can see:

- Account status
- Plan
- AI calling status
- SMS follow-up status
- CRM sync status
- n8n workflow status
- OpenAI qualification status
- Basic metrics
- Activity you mark as client-visible

They cannot see:

- Admin notes
- Other customer accounts
- Internal SMS consent records
- Raw secrets or API keys
- Full CRM/workflow internals

## Master Dashboard

Use `/admin/accounts` for the Autovyne master view.

Use it to:

- Create or update managed accounts
- Turn visible service flags on/off
- Update customer-facing metrics
- Add client-visible or internal activity events
- Review recent leads and questions
- Jump to analytics and SMS compliance proof

Use `/admin/compliance` for Twilio verification proof.

Use `/admin/analytics` for site traffic and conversion signals.

## How The AI Pieces Correlate

- OpenAI is the reasoning layer. It reads lead context and produces qualification, urgency, pain points, and next actions.
- HubSpot is the CRM truth layer. It stores contacts, company info, and sales follow-up status.
- n8n is the orchestration layer. It receives site events and decides what workflow runs next.
- Twilio is the customer communication layer. It sends compliant SMS after opt-in and, later, can power calling workflows.
- Supabase is the operational database. It stores portal accounts, consent proof, leads, questions, and account activity.
- Render is the hosting layer. It deploys the site and runs migrations.

## Current Production Rules

- Never send SMS unless `sms_consent` is true.
- Never pass the phone number to automation when consent is false.
- Store exact SMS consent text with timestamp, source, IP, and user agent.
- Keep customer portal metrics conservative and factual.
- Use placeholders for unknown legal entity/address details until finalized.

## Next Upgrade

The next step is to replace manual metric updates with real event ingestion:

- Twilio inbound/outbound SMS webhook
- Twilio missed-call or voice webhook
- HubSpot deal/contact status webhook
- n8n workflow-completed webhook
- Automatic account event creation from those webhooks

That turns the portal from a managed status dashboard into a live operations dashboard.
