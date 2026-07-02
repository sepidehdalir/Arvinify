# Arvinify — arvinify.com

Marketing site for Arvinify: automated missed-call recovery & 24/7 SMS booking for home service contractors (HVAC, plumbing, electrical, roofing, landscaping). Audience: US & Canada.

## Stack
Static HTML/CSS — zero build step. Vercel serves files as-is.

## Deploy (GitHub → Vercel)
1. Push this folder to a GitHub repo.
2. In Vercel: Add New → Project → import the repo.
3. Framework Preset: **Other**. Build Command: empty. Output Directory: `.`
4. Deploy. Then Settings → Domains → add `arvinify.com`.

Every push to `main` auto-deploys to production.

## Files
- `index.html` — the landing page (all CSS inline, SEO + JSON-LD schema baked in)
- `robots.txt`, `sitemap.xml` — search indexing
- `vercel.json` — clean URLs + security headers

## To-do before launch
- Replace `#start` CTA links with the real onboarding/checkout URL.
- Add a real `og-image.png` (1200×630) at the root for link previews.
- Submit sitemap in Google Search Console.
