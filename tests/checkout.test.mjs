import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { buildCheckoutParams, PILOT_PLANS, validateCheckout } from '../api/checkout.mjs';

function body(overrides = {}) {
  return { requestId: '123e4567-e89b-12d3-a456-426614174000', market: 'us', companyName: 'Northstar Advisory', email: 'jordan@northstar.example', consent: true, source: 'linkedin', ...overrides };
}

function responseMock() {
  return { code: 200, headers: {}, payload: null, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
}

test('checkout prices are server-owned for both markets', () => {
  assert.deepEqual(PILOT_PLANS.us, { market: 'United States', currency: 'usd', amount: 99_500, display: 'US$995' });
  assert.deepEqual(PILOT_PLANS.canada, { market: 'Canada', currency: 'cad', amount: 125_000, display: 'C$1,250' });
  const { order } = validateCheckout(body({ amount: 1, currency: 'btc' }));
  const params = buildCheckoutParams(order, 'https://www.arvinify.com');
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '99500');
  assert.equal(params.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(params.get('mode'), 'payment');
  assert.equal(params.get('success_url'), 'https://www.arvinify.com/payment-success?session_id={CHECKOUT_SESSION_ID}');
});

test('checkout rejects invalid market, email and missing consent', () => {
  assert.match(validateCheckout(body({ market: 'uk' })).error, /United States or Canada/);
  assert.match(validateCheckout(body({ email: 'not-an-email' })).error, /valid work email/);
  assert.match(validateCheckout(body({ consent: false })).error, /accept the pilot terms/);
});

test('handler creates a Stripe-hosted session without exposing the secret', async () => {
  const originalFetch = globalThis.fetch; const originalEnv = { ...process.env }; const calls = [];
  process.env.STRIPE_SECRET_KEY = 'sk_test_example'; process.env.SITE_URL = 'https://www.arvinify.com';
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try {
    const req = { method: 'POST', body: body(), headers: { origin: 'https://www.arvinify.com', host: 'www.arvinify.com', 'x-forwarded-for': '203.0.113.71' }, socket: {} };
    const res = responseMock(); await handler(req, res);
    assert.equal(res.code, 200); assert.equal(res.payload.ok, true); assert.match(res.payload.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer sk_test_example');
    const params = new URLSearchParams(calls[0].options.body);
    assert.equal(params.get('line_items[0][price_data][unit_amount]'), '99500');
    assert.equal(params.get('metadata[source]'), 'linkedin');
    assert.equal(JSON.stringify(res.payload).includes('sk_test_example'), false);
  } finally { globalThis.fetch = originalFetch; process.env = originalEnv; }
});

test('handler fails safely while Stripe is not configured', async () => {
  const originalEnv = { ...process.env }; delete process.env.STRIPE_SECRET_KEY;
  try {
    const req = { method: 'POST', body: body(), headers: { host: 'www.arvinify.com', 'x-forwarded-for': '203.0.113.72' }, socket: {} };
    const res = responseMock(); await handler(req, res);
    assert.equal(res.code, 503); assert.match(res.payload.error, /being activated/i);
  } finally { process.env = originalEnv; }
});
