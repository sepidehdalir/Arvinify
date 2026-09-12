import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import handler, { verifyStripeSignature } from '../api/stripe-webhook.mjs';

const secret = 'whsec_test_example';
const timestamp = 1_800_000_000;
const raw = Buffer.from(JSON.stringify({ id: 'evt_test_paid', type: 'checkout.session.completed', data: { object: { id: 'cs_test_paid', payment_status: 'paid', amount_total: 99_500, currency: 'usd', customer_details: { email: 'jordan@northstar.example' }, metadata: { company: 'Northstar Advisory', market: 'us' } } } }));
const signature = (payload = raw, time = timestamp) => `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${payload.toString('utf8')}`).digest('hex')}`;

function responseMock() {
  return { code: 200, headers: {}, payload: null, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
}

test('verifies a current Stripe signature and rejects tampering or stale events', () => {
  assert.equal(verifyStripeSignature(raw, signature(), secret, timestamp * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.from('tampered'), signature(), secret, timestamp * 1000), false);
  assert.equal(verifyStripeSignature(raw, signature(), secret, (timestamp + 301) * 1000), false);
});

test('paid checkout sends owner and customer onboarding email', async () => {
  const originalFetch = globalThis.fetch; const originalEnv = { ...process.env }; const calls = [];
  process.env.STRIPE_WEBHOOK_SECRET = secret; process.env.RESEND_API_KEY = 're_test'; process.env.LEAD_NOTIFY_TO = 'hello@arvinify.com'; process.env.LEAD_NOTIFY_FROM = 'Arvinify <hello@arvinify.com>';
  globalThis.fetch = async (url, options) => { calls.push({ url, options, body: JSON.parse(options.body) }); return new Response(JSON.stringify({ id: 'email_test' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try {
    const req = { method: 'POST', body: raw, headers: { 'stripe-signature': signature(raw, Math.floor(Date.now() / 1000)) } };
    const currentRaw = Buffer.from(raw.toString());
    req.body = currentRaw;
    const nowTimestamp = Math.floor(Date.now() / 1000);
    req.headers['stripe-signature'] = signature(currentRaw, nowTimestamp);
    const res = responseMock(); await handler(req, res);
    assert.equal(res.code, 200); assert.deepEqual(res.payload, { received: true }); assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.body.to[0]).sort(), ['hello@arvinify.com', 'jordan@northstar.example']);
    assert.ok(calls.every((call) => call.options.headers['Idempotency-Key'].startsWith('arvinify/stripe/evt_test_paid/')));
    const customer = calls.find((call) => call.body.to[0] === 'jordan@northstar.example');
    assert.match(customer.body.text, /No meeting is required/i);
  } finally { globalThis.fetch = originalFetch; process.env = originalEnv; }
});

test('invalid signature is rejected before any email is sent', async () => {
  const originalFetch = globalThis.fetch; const originalEnv = { ...process.env }; let called = false;
  process.env.STRIPE_WEBHOOK_SECRET = secret; globalThis.fetch = async () => { called = true; };
  try {
    const res = responseMock(); await handler({ method: 'POST', body: raw, headers: { 'stripe-signature': 't=1,v1=bad' } }, res);
    assert.equal(res.code, 400); assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; process.env = originalEnv; }
});
