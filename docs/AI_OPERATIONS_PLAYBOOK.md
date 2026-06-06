# Autovyne AI Operations Playbook

## Efficient Customer Flow

1. A business owner lands on Autovyne and uses the ROI + Live Demo page.
2. They choose a plan from `/signup`, enter onboarding details, create a portal password, and accept the posted Terms.
3. Stripe Checkout collects payment using the configured subscription Price for that plan.
4. A verified Stripe success page or webhook marks the signup as paid.
5. Autovyne automatically creates or updates the client portal account, sets it active, and records payment/activation timestamps.
6. Supabase stores the signup order, account data, SMS consent evidence, leads, and questions.
7. n8n receives an `account.paid` event and coordinates setup workflows after payment.
8. OpenAI, HubSpot, Twilio, and other setup steps run from the paid onboarding event.
9. Twilio sends SMS only when the consent checkbox was checked and recorded.
10. The customer sees a limited status view in `/portal`.
11. Autovyne manages all accounts from `/admin/accounts`.

## Customer Portal

Paid customers are created automatically after Stripe confirms payment.

Use `/admin/accounts` when you need to review, update, or manually correct a managed account.

Give the customer:

- Portal URL: `/portal`
- Their email address
- The portal password they created during signup

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
- Keep Stripe recurring Price IDs mapped to the matching Autovyne plan in Render.
- Add optional Stripe setup Price IDs for launch/setup fees when a plan has an upfront onboarding charge.
- Treat Stripe webhooks as the source of truth for account activation after payment.
- Do not activate unpaid accounts through the public signup flow.

## Next Upgrade

The next step is to replace manual metric updates with real event ingestion:

- Twilio inbound/outbound SMS webhook
- Twilio missed-call or voice webhook
- HubSpot deal/contact status webhook
- n8n workflow-completed webhook
- Automatic account event creation from those webhooks

That turns the portal from a managed status dashboard into a live operations dashboard.
