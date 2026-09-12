# Arvinify

Arvinify's LinkedIn-first acquisition site, written qualification flow and secure checkout for fixed-scope B2B service pilots in the United States and Canada.

## What is live in this repository

- LinkedIn-to-revenue landing page for US and Canadian B2B services (`index.html`)
- Three-step written pilot fit check with no phone or meeting requirement (`start.html`)
- Market-aware online purchase page (`buy.html`) and checkout return page (`payment-success.html`)
- Website Rescue brief preserved at `/rescue` (`rescue.html` + `api/rescue.js`)
- LinkedIn-to-revenue qualification with a deterministic rules fallback (`api/lead.mjs`)
- Immediate customer acknowledgement and owner notification through Resend
- Async written qualification and next-step handoff with no sales-call requirement
- Server-created Stripe Checkout sessions in USD or CAD (`api/checkout.mjs`)
- Signed Stripe webhook handling for paid-pilot onboarding (`api/stripe-webhook.mjs`)
- Optional signed CRM webhook and one scheduled follow-up
- Server-side validation, honeypot, request-size limit, origin check and best-effort rate limiting
- Internal Sunify founding-pilot measurement plan (`docs/SUNIFY_PILOT.md`)

The product deliberately avoids LinkedIn scraping, mass DMs, credential sharing and unattended outreach. LinkedIn creates attention; the tracked CTA, written qualification, human-approved follow-up and checkout convert it into a measurable business path.

## Runtime

Static HTML/CSS/JavaScript plus Vercel Node.js Functions. There is no frontend build step.

```bash
npm install
npm test
```

## Deploy

The GitHub repository is connected to the existing Vercel `arvinify` project. A push to `main` triggers the production deployment. Keep the Vercel framework preset set to **Other**, with no build command and `.` as the output directory.

Before accepting real briefs, add the server-only values documented in `.env.example` to Vercel. At minimum, configure the Resend variables and a verified `LEAD_NOTIFY_FROM` address. AI Gateway uses Vercel OIDC in deployments; an explicit `AI_GATEWAY_API_KEY` is optional there.

To activate payment:

1. Add `STRIPE_SECRET_KEY` to the Vercel project for Preview and Production as appropriate.
2. In Stripe, create a webhook endpoint for `https://www.arvinify.com/api/stripe-webhook` and subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
3. Add the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.
4. Set `STRIPE_AUTOMATIC_TAX=true` only after Stripe Tax is configured for the account.
5. Redeploy and complete one Stripe test-mode purchase before enabling live mode.

Prices and currencies are owned by `api/checkout.mjs`, not accepted from browser input. The online charge is the fixed setup fee only. Monthly monitoring is activated and billed separately after written go-live approval.

## Verification

The test suite validates lead and checkout input, server-owned pricing, Stripe request construction, webhook signatures, Resend payload creation and the async written-response flow without sending real email or creating a real charge.
