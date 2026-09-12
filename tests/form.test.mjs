import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../start.html', import.meta.url), 'utf8');

test('pilot fit check advances through all steps and submits the expected payload', async () => {
  const requests = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://www.arvinify.com/start?source=linkedin',
    beforeParse(window) {
      window.scrollTo = () => {};
      window.fetch = async (url, options) => {
        requests.push({ url, options, body: JSON.parse(options.body) });
        return { ok: true, json: async () => ({ ok: true, message: 'A written pilot fit decision is on its way—no meeting required.' }) };
      };
    }
  });
  const { document, Event } = dom.window;

  document.querySelector('[name="companyName"]').value = 'North Shore Renovations';
  document.querySelector('[name="websiteUrl"]').value = 'northshorerenovations.example';
  document.querySelector('[data-group="businessType"] [data-value="renovation"]').click();
  document.querySelector('.step[data-step="1"] [data-next]').click();
  assert.ok(document.querySelector('.step[data-step="2"]').classList.contains('active'));

  document.querySelector('[data-group="bottleneck"] [data-value="slow_response"]').click();
  document.querySelector('[data-group="tools"] [data-value="website"]').click();
  document.querySelector('[data-group="tools"] [data-value="inbox"]').click();
  document.querySelector('[name="leadVolume"]').value = '51_200';
  document.querySelector('[name="dealValue"]').value = '10k_50k';
  document.querySelector('[name="timeline"]').value = '30_days';
  document.querySelector('[name="details"]').value = 'The team manually reviews every request before replying.';
  document.querySelector('.step[data-step="2"] [data-next]').click();
  assert.ok(document.querySelector('.step[data-step="3"]').classList.contains('active'));

  document.querySelector('[name="name"]').value = 'Jordan Alvarez';
  document.querySelector('[name="email"]').value = 'jordan@northstar.example';
  document.querySelector('[name="consent"]').checked = true;
  document.querySelector('#leadForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/lead');
  assert.equal(requests[0].body.source, 'linkedin');
  assert.equal(requests[0].body.bottleneck, 'slow_response');
  assert.equal(requests[0].body.businessType, 'renovation');
  assert.deepEqual(requests[0].body.tools, ['website', 'inbox']);
  assert.equal(requests[0].body.phone, '');
  assert.equal(requests[0].body.consent, true);
  assert.equal(document.querySelector('#leadForm').hidden, true);
  assert.ok(document.querySelector('#success').classList.contains('active'));
  assert.equal(document.querySelector('#bookingButton'), null);
  assert.match(document.querySelector('#successMessage').textContent, /pilot fit decision/i);

  dom.window.close();
});

test('form blocks progress until required business context is present', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://www.arvinify.com/start', beforeParse(window) { window.scrollTo = () => {}; } });
  const { document } = dom.window;
  document.querySelector('.step[data-step="1"] [data-next]').click();
  assert.ok(document.querySelector('.step[data-step="1"]').classList.contains('active'));
  assert.match(document.querySelector('[data-error="companyName"]').textContent, /company name/i);
  assert.match(document.querySelector('[data-error="websiteUrl"]').textContent, /valid website/i);
  assert.equal(document.querySelector('[name="phone"]'), null);
  dom.window.close();
});
