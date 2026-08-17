// Arvinify Website Rescue — lead intake endpoint (Vercel serverless).
//
// Real submission: validates server-side, applies basic spam/abuse
// protection, and delivers the lead by email via Resend. Never returns a
// success unless Resend actually accepted the message.
//
// Add a CRM/database destination later at the persistLead() seam below —
// nothing else in this handler needs to change.

var RATE = new Map(); // best-effort in-memory limiter (per warm instance)

var ALLOWED_CATEGORIES = [
  "Mobile issue", "Form / booking", "Shopify / ecommerce", "Broken layout",
  "Button / navigation", "Speed / performance", "Something else"
];
var ALLOWED_TYPES = ["website_rescue", "free_check"];
var ALLOWED_TIERS = ["rescue", "advanced", "project", ""];

var CONTROL_CHARS = /[\u0000-\u001F\u007F]+/g;
var MULTI_SPACE = /\s{2,}/g;

function isEmail(v) { return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function looksLikeUrl(v) {
  if (typeof v !== "string") return false;
  var s = v.trim();
  return /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/.test(s) && s.length <= 400;
}
function clean(v, max) {
  // Strip control chars (incl. newlines/tabs) to spaces, collapse runs,
  // trim, and cap length. Preserves ordinary punctuation and apostrophes.
  return String(v == null ? "" : v).replace(CONTROL_CHARS, " ").replace(MULTI_SPACE, " ").trim().slice(0, max);
}
function redactEmail(v) {
  if (!isEmail(v)) return "(invalid)";
  var p = v.split("@");
  return p[0].slice(0, 2) + "***@" + p[1];
}

function rateLimited(ip) {
  var now = Date.now(), windowMs = 10 * 60 * 1000, limit = 5;
  var rec = RATE.get(ip);
  if (!rec || now - rec.start > windowMs) { RATE.set(ip, { start: now, count: 1 }); return false; }
  rec.count += 1;
  return rec.count > limit;
}

async function sendViaResend(lead) {
  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    var e = new Error("Email delivery is not configured");
    e.code = "NOT_CONFIGURED";
    throw e;
  }
  var to = process.env.LEAD_NOTIFY_TO || "hello@arvinify.com";
  var from = process.env.LEAD_NOTIFY_FROM || "Arvinify Rescue <onboarding@resend.dev>";

  var subjectLabel = lead.submissionType === "free_check"
    ? "Free Website Check"
    : (lead.tier === "advanced" ? "Advanced Repair" : lead.tier === "project" ? "Larger Project" : "Website Rescue");

  var text = [
    subjectLabel + " request",
    "",
    "Submission type: " + lead.submissionType,
    "Tier: " + (lead.tier || "(n/a)"),
    "Website: " + lead.websiteUrl,
    "Issue category: " + (lead.issueCategory || "(not specified)"),
    "Description: " + (lead.description || "(none provided)"),
    "",
    "Name: " + lead.name,
    "Email: " + lead.email,
    "Phone: " + (lead.phone || "(not provided)"),
    "",
    "Submitted: " + lead.timestamp,
    "Source: " + lead.source
  ].join("\n");

  var res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: from,
      to: [to],
      reply_to: lead.email,
      subject: subjectLabel + " — " + lead.websiteUrl,
      text: text
    })
  });
  if (!res.ok) {
    var errBody = await res.text().catch(function () { return ""; });
    var err = new Error("Email provider rejected the message: " + res.status + " " + errBody.slice(0, 200));
    err.code = "DELIVERY_FAILED";
    throw err;
  }
  return res.json().catch(function () { return {}; });
}

// SEAM: add persistent storage / CRM forwarding here later (e.g. Upstash
// Redis, Airtable, HubSpot). Left intentionally as a no-op so the current
// architecture stays a single lightweight function with no database.
async function persistLead(_lead) { /* intentionally empty for now */ }

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  var ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "unknown";

  var body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // Honeypot: real users never fill this hidden field. Bots do. Accept
  // silently so the bot believes it succeeded, but do nothing.
  if (clean(body.company_website, 100)) {
    console.log("[rescue] honeypot triggered, dropping");
    return res.status(200).json({ ok: true });
  }

  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again in a few minutes." });
  }

  var submissionType = ALLOWED_TYPES.indexOf(body.submissionType) >= 0 ? body.submissionType : "website_rescue";
  var tier = ALLOWED_TIERS.indexOf(body.tier) >= 0 ? body.tier : "";
  var websiteUrl = clean(body.websiteUrl, 400);
  var issueCategory = clean(body.issueCategory, 60);
  var description = clean(body.description, 4000);
  var name = clean(body.name, 120);
  var email = clean(body.email, 160);
  var phone = clean(body.phone, 40);
  var isCheck = submissionType === "free_check";

  // Server-side validation (mirrors the client, never trusts it)
  if (!looksLikeUrl(websiteUrl)) return res.status(400).json({ ok: false, error: "A valid website address is required." });
  if (!name) return res.status(400).json({ ok: false, error: "Your name is required." });
  if (!isEmail(email)) return res.status(400).json({ ok: false, error: "A valid email is required." });
  if (!isCheck) {
    if (ALLOWED_CATEGORIES.indexOf(issueCategory) < 0) return res.status(400).json({ ok: false, error: "Please choose an issue category." });
    if (!description) return res.status(400).json({ ok: false, error: "A short description is required." });
  } else if (issueCategory && ALLOWED_CATEGORIES.indexOf(issueCategory) < 0) {
    issueCategory = "";
  }

  var lead = {
    submissionType: submissionType,
    tier: tier,
    websiteUrl: websiteUrl,
    issueCategory: issueCategory,
    description: description,
    name: name,
    email: email,
    phone: phone,
    timestamp: new Date().toISOString(),
    source: "arvinify_start_form"
  };

  try {
    await sendViaResend(lead);
    await persistLead(lead);
  } catch (err) {
    if (err.code === "NOT_CONFIGURED") {
      console.error("[rescue] RESEND_API_KEY not set — cannot deliver lead");
      return res.status(503).json({ ok: false, error: "Submissions aren't switched on yet. Please email hello@arvinify.com for now." });
    }
    console.error("[rescue] delivery failed:", err.code || "", err.message);
    return res.status(502).json({ ok: false, error: "We couldn't submit your request. Please try again, or email hello@arvinify.com." });
  }

  console.log("[rescue] lead delivered:", { type: lead.submissionType, tier: lead.tier || "-", email: redactEmail(lead.email) });
  return res.status(200).json({ ok: true });
};
