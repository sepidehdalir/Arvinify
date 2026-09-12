# Arvinify

Arvinify's marketing site and written intake system for a fixed-scope home-service lead-response pilot in Canada.

## What is live in this repository

- High-end responsive home-service pilot landing page (`index.html`)
- Three-step written pilot fit check (`start.html`)
- Website Rescue brief preserved at `/rescue` (`rescue.html` + `api/rescue.js`)
- Home-service pilot qualification with a deterministic rules fallback (`api/lead.mjs`)
- Immediate customer acknowledgement and owner notification through Resend
- Async written qualification and next-step handoff with no sales-call requirement
- Optional signed CRM webhook and one scheduled follow-up
- Server-side validation, honeypot, request-size limit, origin check and best-effort rate limiting
- Internal Sunify founding-pilot measurement plan (`docs/SUNIFY_PILOT.md`)

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

The test suite validates input normalization, enum rejection, deterministic scoring, Resend payload creation and the async written-response flow without sending real email.
