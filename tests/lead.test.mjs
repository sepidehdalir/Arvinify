import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { rulesQualification, validateLead } from '../api/lead.mjs';

function validBody(overrides = {}) {
  return {
    requestId: '123e4567-e89b-12d3-a456-426614174000',
    companyName: 'Northstar Advisory',
    websiteUrl: 'northstar.example',
    market: 'us',
    businessType: 'consultancy',
    bottleneck: 'profile_conversion',
    tools: ['linkedin_personal', 'linkedin_company', 'website', 'inbox'],
    leadVolume: '200_plus',
    dealValue: '50k_plus',
    timeline: 'now',
    details: 'The founder posts on LinkedIn, but interested buyers reach a generic homepage and the team cannot attribute qualified opportunities.',
    name: 'Jordan Alvarez',
    email: 'jordan@northstar.example',
    phone: '',
    consent: true,
    source: 'test',
    ...overrides
  };
}

function responseMock() {
  return {
    code: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test('validates and normalizes an accepted lead', () => {
  const result = validateLead(validBody());
  assert.ok(result.lead);
  assert.equal(result.lead.websiteUrl, 'https://northstar.example/');
  assert.equal(result.lead.email, 'jordan@northstar.example');
  assert.equal(result.lead.market, 'us');
  assert.deepEqual(result.lead.tools, ['linkedin_personal', 'linkedin_company', 'website', 'inbox']);
});

test('rejects missing consent and invalid enum values', () => {
  assert.match(validateLead(validBody({ consent: false })).error, /Consent/);
  assert.match(validateLead(validBody({ market: 'uk' })).error, /market/);
  assert.match(validateLead(validBody({ businessType: 'ignore_previous_instructions' })).error, /business type/);
});

test('rules qualification routes a strong, time-sensitive fit to written scope', () => {
  const { lead } = validateLead(validBody());
  const result = rulesQualification(lead);
  assert.equal(result.priority, 'high');
  assert.equal(result.recommendedAction, 'written_scope');
  assert.ok(result.score >= 70);
});

test('handler uses rules fallback, sends both async emails, and returns no meeting CTA', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const calls = [];
  process.env.AI_DISABLED = 'true';
  process.env.RESEND_API_KEY = 're_test';
  process.env.LEAD_NOTIFY_FROM = 'Arvinify <hello@arvinify.com>';
  process.env.LEAD_NOTIFY_TO = 'hello@arvinify.com';
  delete process.env.BOOKING_URL;
  delete process.env.CRM_WEBHOOK_URL;
  delete process.env.FOLLOW_UP_ENABLED;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ id: `email-${calls.length}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const req = { method: 'POST', body: validBody(), headers: { 'x-forwarded-for': '203.0.113.14' }, socket: {} };
    const res = responseMock();
    await handler(req, res);
    assert.equal(res.code, 200);
    assert.equal(res.payload.ok, true);
    assert.equal('bookingUrl' in res.payload, false);
    assert.match(res.payload.message, /pilot fit decision/i);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.body.to[0]).sort(), ['hello@arvinify.com', 'jordan@northstar.example']);
    assert.ok(calls.every((call) => call.options.headers['Idempotency-Key']));
    const customerEmail = calls.find((call) => call.body.to[0] === 'jordan@northstar.example');
    assert.match(customerEmail.body.text, /No call or meeting is required/i);
    assert.match(customerEmail.body.subject, /pilot fit request/i);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});
