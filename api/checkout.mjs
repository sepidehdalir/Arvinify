import { randomUUID } from 'node:crypto';

const RATE = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const MAX_BODY_BYTES = 8_000;

export const PILOT_PLANS = Object.freeze({
  us: Object.freeze({ market: 'United States', currency: 'usd', amount: 99_500, display: 'US$995' }),
  canada: Object.freeze({ market: 'Canada', currency: 'cad', amount: 125_000, display: 'C$1,250' })
});

function cleanLine(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function requestIp(req) {
  return cleanLine(String(req.headers?.['x-forwarded-for'] || '').split(',')[0], 80) || req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = RATE.get(ip);
  if (!record || now - record.startedAt > RATE_WINDOW_MS) {
    RATE.set(ip, { startedAt: now, count: 1 });
    if (RATE.size > 2_000) {
      for (const [key, item] of RATE) if (now - item.startedAt > RATE_WINDOW_MS) RATE.delete(key);
    }
    return false;
  }
  record.count += 1;
  return record.count > RATE_LIMIT;
}

function originAllowed(req) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = cleanLine(req.headers?.['x-forwarded-host'] || req.headers?.host, 250).toLowerCase();
    const configuredHost = process.env.SITE_URL ? new URL(process.env.SITE_URL).host.toLowerCase() : '';
    return originHost === requestHost || (configuredHost && originHost === configuredHost);
  } catch {
    return false;
  }
}

function checkoutBaseUrl(req) {
  const origin = req.headers?.origin;
  if (origin && originAllowed(req)) return new URL(origin).origin;
  if (process.env.SITE_URL) return new URL(process.env.SITE_URL).origin;
  const host = cleanLine(req.headers?.['x-forwarded-host'] || req.headers?.host, 250);
  if (host) return `https://${host}`;
  return 'https://www.arvinify.com';
}

export function validateCheckout(body) {
  const market = cleanLine(body.market, 20).toLowerCase();
  const requestIdRaw = cleanLine(body.requestId, 80);
  const order = {
    requestId: /^[a-zA-Z0-9-]{12,80}$/.test(requestIdRaw) ? requestIdRaw : randomUUID(),
    market,
    companyName: cleanLine(body.companyName, 120),
    email: cleanLine(body.email, 160).toLowerCase(),
    source: cleanLine(body.source, 80) || 'website',
    consent: body.consent === true
  };
  if (!PILOT_PLANS[order.market]) return { error: 'Choose the United States or Canada.' };
  if (!order.companyName) return { error: 'Company name is required.' };
  if (!isEmail(order.email)) return { error: 'A valid work email is required.' };
  if (!order.consent) return { error: 'Please accept the pilot terms before checkout.' };
  return { order };
}

export function buildCheckoutParams(order, baseUrl, options = {}) {
  const plan = PILOT_PLANS[order.market];
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('client_reference_id', order.requestId);
  params.set('customer_email', order.email);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', plan.currency);
  params.set('line_items[0][price_data][unit_amount]', String(plan.amount));
  params.set('line_items[0][price_data][product_data][name]', 'Arvinify LinkedIn-to-Revenue Founding Pilot');
  params.set('line_items[0][price_data][product_data][description]', `Fixed-scope setup for one ${plan.market} LinkedIn-to-revenue path. Monthly monitoring is activated separately after written go-live approval.`);
  params.set('billing_address_collection', 'required');
  params.set('tax_id_collection[enabled]', 'true');
  params.set('allow_promotion_codes', 'true');
  params.set('success_url', `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${baseUrl}/buy?cancelled=1`);
  params.set('metadata[plan]', 'linkedin_revenue_founding_pilot');
  params.set('metadata[market]', order.market);
  params.set('metadata[company]', order.companyName);
  params.set('metadata[source]', order.source);
  params.set('payment_intent_data[metadata][plan]', 'linkedin_revenue_founding_pilot');
  params.set('payment_intent_data[metadata][market]', order.market);
  params.set('payment_intent_data[metadata][company]', order.companyName);
  if (options.automaticTax) params.set('automatic_tax[enabled]', 'true');
  return params;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  if (!originAllowed(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });
  const contentLength = Number.parseInt(req.headers?.['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ ok: false, error: 'Request is too large.' });
  if (isRateLimited(requestIp(req))) return res.status(429).json({ ok: false, error: 'Too many checkout attempts. Please try again in a few minutes.' });

  const result = validateCheckout(parseBody(req));
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[checkout] STRIPE_SECRET_KEY is not configured');
    return res.status(503).json({ ok: false, error: 'Secure checkout is being activated. Please email hello@arvinify.com if you want to start now.' });
  }

  const { order } = result;
  const params = buildCheckoutParams(order, checkoutBaseUrl(req), { automaticTax: process.env.STRIPE_AUTOMATIC_TAX === 'true' });
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `arvinify-checkout-${order.requestId}`
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      console.error('[checkout] Stripe rejected the session', { status: response.status, type: data?.error?.type, code: data?.error?.code });
      return res.status(502).json({ ok: false, error: 'Secure checkout could not be opened. Please try again or email hello@arvinify.com.' });
    }
    const checkoutUrl = new URL(data.url);
    if (checkoutUrl.protocol !== 'https:') throw new Error('Stripe returned an invalid checkout URL');
    console.log('[checkout] session created', { requestId: order.requestId, market: order.market, company: order.companyName });
    return res.status(200).json({ ok: true, url: checkoutUrl.toString() });
  } catch (error) {
    console.error('[checkout] session creation failed:', error?.message || error);
    return res.status(502).json({ ok: false, error: 'Secure checkout could not be opened. Please try again or email hello@arvinify.com.' });
  }
}
