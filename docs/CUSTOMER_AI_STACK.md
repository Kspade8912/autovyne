# Autovyne Customer Deployment Stack

Use one isolated customer configuration per business. Do not reuse customer credentials, phone numbers, consent records, or production workflows across accounts.

## Core Stack

1. **Autovyne website and API on Render**
   - Captures audit/signup requests and explicit SMS consent.
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

1. Customer submits the Autovyne audit or questions form.
2. Confirm the requested workflow, business hours, escalation contacts, FAQs, calendar, CRM, and approved message templates.
3. Sign the customer agreement and confirm subscription/payment terms.
4. Create isolated customer records and credentials.
5. Obtain and document the customer's authority and consent process for their own leads/customers.
6. Configure HubSpot pipeline and n8n workflow.
7. Provision and register the Twilio sender.
8. Build the AI prompt, knowledge base, guardrails, human handoff, and failure path.
9. Test normal, invalid, opt-out, HELP, after-hours, escalation, and provider-outage scenarios.
10. Obtain customer approval, launch gradually, and monitor calls, messages, opt-outs, errors, and conversion.

## Production Gate

A customer workflow is ready only when:

- Twilio registration is approved.
- Legal pages and consent language match the live message program.
- SMS sends are impossible when `sms_eligible` is false.
- STOP and HELP are tested.
- Customer data and credentials are isolated.
- Human escalation works.
- Logs and provider alerts are enabled.
- The customer approved the final scripts, prompts, and message templates.
