import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = { api: { bodyParser: false } };

function cleanLine(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function verifyStripeSignature(rawBody, signatureHeader, secret, nowMs = Date.now()) {
  if (!signatureHeader || !secret) return false;
  const parts = String(signatureHeader).split(',').map((part) => part.trim().split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest();
  return signatures.some((candidate) => {
    try {
      const received = Buffer.from(candidate, 'hex');
      return received.length === expected.length && timingSafeEqual(received, expected);
    } catch {
      return false;
    }
  });
}

function emailFrame(content) {
  return `<!doctype html><html><body style="margin:0;background:#050b14;color:#f2f7fb;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:36px 20px"><div style="font-size:20px;font-weight:700;margin-bottom:26px">Arvinify</div><div style="border:1px solid #20374b;border-radius:18px;background:#0a1727;padding:30px">${content}</div><p style="color:#6f8398;font-size:12px;line-height:1.6;margin:20px 4px 0">Arvinify · United States + Canada · <a style="color:#9fb0c2" href="https://www.arvinify.com/terms">Terms</a></p></div></body></html>`;
}

async function sendResend(payload, idempotencyKey) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey.slice(0, 256)
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
}

async function deliverPaidPilot(session, eventId) {
  const company = cleanLine(session.metadata?.company || session.customer_details?.name || 'New customer', 120);
  const market = session.metadata?.market === 'us' ? 'United States' : session.metadata?.market === 'canada' ? 'Canada' : 'Not provided';
  const email = cleanLine(session.customer_details?.email || session.customer_email, 160).toLowerCase();
  const currency = cleanLine(session.currency, 8).toUpperCase();
  const amount = Number.isFinite(session.amount_total) ? `${currency} ${(session.amount_total / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `${currency} payment`;
  const from = process.env.LEAD_NOTIFY_FROM || 'Arvinify <hello@arvinify.com>';
  const owner = process.env.LEAD_NOTIFY_TO || 'hello@arvinify.com';
  const replyTo = process.env.LEAD_REPLY_TO || owner;

  const messages = [{
    from,
    to: [owner],
    reply_to: email || replyTo,
    subject: `[PAID] ${company} — ${amount}`,
    html: emailFrame(`<p style="margin-top:0;color:#7cf7c5;font-size:12px;font-weight:700;letter-spacing:.12em">PILOT PAYMENT RECEIVED</p><h1 style="font-size:28px;line-height:1.15;margin:8px 0 18px">${escapeHtml(company)}</h1><p style="color:#c8d5df;line-height:1.7">Amount: ${escapeHtml(amount)}<br>Market: ${escapeHtml(market)}<br>Email: ${escapeHtml(email || 'Not provided')}<br>Stripe session: ${escapeHtml(session.id)}</p><p style="color:#9fb0c2;line-height:1.7">Send the written onboarding request and confirm scope before implementation begins.</p>`),
    text: `Pilot payment received\n\nCompany: ${company}\nAmount: ${amount}\nMarket: ${market}\nEmail: ${email || 'Not provided'}\nStripe session: ${session.id}`,
    tags: [{ name: 'type', value: 'pilot_payment' }]
  }];

  if (email) {
    messages.push({
      from,
      to: [email],
      reply_to: replyTo,
      subject: 'Payment received — your Arvinify pilot',
      html: emailFrame(`<p style="margin-top:0;color:#6ee7ff;font-size:12px;font-weight:700;letter-spacing:.12em">PAYMENT RECEIVED</p><h1 style="font-size:28px;line-height:1.15;margin:8px 0 18px">Your written onboarding starts here.</h1><p style="color:#c8d5df;line-height:1.7">We received the ${escapeHtml(amount)} setup payment for ${escapeHtml(company)}. Reply with the LinkedIn profile or company-page URL, the offer you want to sell and the buyer you want to reach. No meeting is required.</p><p style="color:#9fb0c2;line-height:1.7">We will confirm scope, access and the target launch date in writing before implementation begins.</p>`),
      text: `We received the ${amount} setup payment for ${company}. Reply with the LinkedIn profile or company-page URL, the offer you want to sell and the buyer you want to reach. No meeting is required. We will confirm scope, access and the target launch date in writing before implementation begins.`,
      tags: [{ name: 'type', value: 'pilot_payment_confirmation' }]
    });
  }

  await Promise.all(messages.map((message, index) => sendResend(message, `arvinify/stripe/${eventId}/${index}`)));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ received: false });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ received: false });
  }
  const rawBody = await readRawBody(req);
  if (!verifyStripeSignature(rawBody, req.headers?.['stripe-signature'], secret)) {
    return res.status(400).json({ received: false, error: 'Invalid signature.' });
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ received: false, error: 'Invalid payload.' });
  }

  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const session = event.data?.object || {};
    if (session.payment_status === 'paid') {
      try {
        await deliverPaidPilot(session, cleanLine(event.id, 120));
      } catch (error) {
        console.error('[stripe-webhook] onboarding email failed:', error?.message || error);
        return res.status(500).json({ received: false });
      }
    }
  }
  return res.status(200).json({ received: true });
}
