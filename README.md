# Arvinify

Arvinify's production marketing site and AI revenue-intake system for B2B service firms.

## What is live in this repository

- High-end responsive landing page (`index.html`)
- Three-step revenue brief (`start.html`)
- Website Rescue brief preserved at `/rescue` (`rescue.html` + `api/rescue.js`)
- AI qualification with a deterministic rules fallback (`api/lead.mjs`)
- Immediate customer acknowledgement and owner notification through Resend
- Qualified-lead booking handoff when `BOOKING_URL` is configured
- Optional signed CRM webhook and one scheduled follow-up
- Server-side validation, honeypot, request-size limit, origin check and best-effort rate limiting

## Runtime

Static HTML/CSS/JavaScript plus Vercel Node.js Functions. There is no frontend build step.

```bash
npm install
npm test
```

## Deploy

The GitHub repository is connected to the existing Vercel `arvinify` project. A push to `main` triggers the production deployment. Keep the Vercel framework preset set to **Other**, with no build command and `.` as the output directory.

Before accepting real briefs, add the server-only values documented in `.env.example` to Vercel. At minimum, configure the Resend variables and a verified `LEAD_NOTIFY_FROM` address. AI Gateway uses Vercel OIDC in deployments; an explicit `AI_GATEWAY_API_KEY` is optional there.

## Verification

The test suite validates input normalization, enum rejection, deterministic scoring, Resend payload creation and qualified booking behavior without sending real email.
