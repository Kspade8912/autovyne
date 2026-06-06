# Autovyne Customer Deployment Stack

Use one isolated customer configuration per business. Do not reuse customer credentials, phone numbers, consent records, or production workflows across accounts.

## Core Stack

1. **Autovyne website and API on Render**
   - Captures paid signup/onboarding requests and explicit SMS consent.
   - Redirects customers to Stripe Checkout before portal activation.
   - Runs the OpenAI qualification step.
   - Syncs contacts to HubSpot.
   - Sends consent-aware events to n8n.

2. **Supabase Postgres**
   - Stores leads, questions, audit submissions, and immutable SMS consent proof.
   - Review proof at `/admin/compliance`.

3. **OpenAI**
   - Qualifies leads and powers customer-specific assistants.
   - Give each customer an approved prompt, knowledge base, escalation rules, and test set.

4. **HubSpot**
   - Stores contacts and customer pipeline status.
   - Create customer-specific properties, pipelines, owners, and follow-up rules as needed.

5. **n8n**
   - Orchestrates approved workflows between Autovyne, HubSpot, Twilio, calendars, and customer systems.
   - Every SMS branch must require `sms_eligible === true`.

6. **Twilio**
   - Use an approved toll-free number or registered messaging sender.
   - Complete toll-free verification or applicable A2P registration before production messaging.
   - Configure STOP/HELP handling and keep the public Privacy Policy, Terms, and SMS Terms current.

## Customer Signup to Launch

1. Customer submits `/signup`, enters onboarding details, creates a portal password, and accepts the posted Terms.
2. Customer chooses automatic monthly card payments or manual monthly billing.
3. Automatic billing uses Stripe Checkout to confirm the first subscription payment, activates the portal account, and sends an `account.paid` event to n8n.
4. Manual billing creates a `needs_attention` account and sends an `account.manual_billing_requested` event so Autovyne can handle billing before paid setup starts.
5. Confirm the requested workflow, business hours, escalation contacts, FAQs, calendar, CRM, and approved message templates.
6. Obtain and document the customer's authority and consent process for their own leads/customers.
7. Configure isolated HubSpot pipeline data and n8n workflow branches.
8. Provision and register the Twilio sender.
9. Build the AI prompt, knowledge base, guardrails, human handoff, and failure path.
10. Test normal, invalid, opt-out, HELP, after-hours, escalation, and provider-outage scenarios.
11. Obtain customer approval, launch gradually, and monitor calls, messages, opt-outs, errors, and conversion.

## Production Gate

A customer workflow is ready only when:

- Twilio registration is approved.
- Stripe monthly signup, webhook activation, manual billing flag, and plan Price mapping are tested.
- Legal pages and consent language match the live message program.
- SMS sends are impossible when `sms_eligible` is false.
- STOP and HELP are tested.
- Customer data and credentials are isolated.
- Human escalation works.
- Logs and provider alerts are enabled.
- The customer approved the final scripts, prompts, and message templates.
