# Sunify Lead-Response Pilot

Internal implementation plan for validating Arvinify on a real contractor workflow before publishing performance claims.

## Pilot outcome

Turn a new Sunify website enquiry into an owner-ready job summary without requiring someone to watch the inbox.

The first version should:

1. Acknowledge a valid enquiry within 60 seconds under normal provider operation.
2. Collect the job address, service category, urgency, preferred timing and photos when relevant.
3. Check the service area and supported-work rules.
4. Send Sunify a structured summary with a clear human next action.
5. Send one approved follow-up when required information is still missing.
6. Never quote, promise availability or accept work without human approval.

## Fixed pilot boundary

- One source: the primary website enquiry form.
- One delivery channel: the existing Sunify owner inbox.
- Email acknowledgement and one email follow-up sequence.
- Up to six qualification questions.
- One service-area rule set and one job-fit rule set.
- Human approval before estimates, appointments or commitments.
- No replacement CRM, outbound prospecting, voice agent or automatic pricing in phase one.

## Inputs to confirm

- Current form endpoint and notification address.
- Exact Metro Vancouver service area.
- Supported service categories and clear exclusions.
- Minimum information needed before Sunify can review a job.
- Which requests count as urgent.
- Approved acknowledgement and follow-up wording.
- Inbox that should receive owner-ready summaries.

Do not store passwords, API keys or mailbox credentials in this document or the repository.

## Baseline before launch

Measure at least seven days when practical:

- Median time to first useful response.
- Number of valid enquiries.
- Percentage containing address, service, timing and photos where relevant.
- Number ready for owner review without another clarification email.
- Number receiving a follow-up.
- Number reaching estimate, site visit or decline.

If historical records are incomplete, mark the baseline as unavailable instead of estimating it.

## 30-day pilot scorecard

| Metric | Baseline | Pilot result | Notes |
|---|---:|---:|---|
| Median first-response time | TBD | TBD | Exclude spam and provider outages |
| Valid enquiries received | TBD | TBD | Count unique enquiries |
| Complete job-detail rate | TBD | TBD | Address, service, timing, relevant photos |
| Owner-ready handoff rate | TBD | TBD | No extra clarification required before review |
| Approved follow-up coverage | TBD | TBD | Only consented, eligible enquiries |
| Estimate / site-visit progression | TBD | TBD | Human-approved outcome only |

## Launch gates

- All messages approved in writing.
- Test enquiries cover valid, incomplete, out-of-area, unsupported, urgent and spam cases.
- Duplicate submissions do not create duplicate customer messages.
- Failure alerts reach the owner inbox.
- A manual fallback path is documented.
- Privacy wording matches the information collected.

## Evidence rule

Arvinify may publish a Sunify case study only after the measurement window closes and Sunify approves the exact figures and wording. Until then, describe Sunify only as an internal founding pilot and do not claim conversion or revenue improvement.
