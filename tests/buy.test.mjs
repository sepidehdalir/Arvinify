import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../buy.html', import.meta.url), 'utf8');

test('purchase page switches market pricing and submits only order context', async () => {
  const requests = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://www.arvinify.com/buy?source=linkedin',
    beforeParse(window) {
      window.fetch = async (url, options) => {
        requests.push({ url, options, body: JSON.parse(options.body) });
        return { ok: false, json: async () => ({ ok: false, error: 'Secure checkout is being activated.' }) };
      };
    }
  });
  const { document, Event } = dom.window;
  document.querySelector('[data-value="canada"]').click();
  assert.equal(document.querySelector('#priceLabel').textContent, 'C$1,250');
  document.querySelector('[name="companyName"]').value = 'Maple Advisory';
  document.querySelector('[name="email"]').value = 'buyer@maple.example';
  document.querySelector('[name="consent"]').checked = true;
  document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/checkout');
  assert.equal(requests[0].body.market, 'canada');
  assert.equal(requests[0].body.source, 'linkedin');
  assert.equal('amount' in requests[0].body, false);
  assert.equal('currency' in requests[0].body, false);
  assert.match(document.querySelector('#submitError').textContent, /being activated/i);
  dom.window.close();
});

test('cancelled checkout explains that nothing was charged', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://www.arvinify.com/buy?cancelled=1' });
  assert.ok(dom.window.document.querySelector('#cancelNotice').classList.contains('show'));
  assert.match(dom.window.document.querySelector('#cancelNotice').textContent, /Nothing was charged/i);
  dom.window.close();
});
