import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://www.arvinify.com/' });
const { document } = dom.window;

test('homepage presents one fixed-price Canadian home-service pilot', () => {
  assert.match(document.title, /Canadian Home Services/i);
  assert.match(document.querySelector('h1').textContent, /quote-ready job/i);
  assert.match(document.querySelector('#pilot').textContent, /C\$1,250/);
  assert.match(document.querySelector('#pilot').textContent, /C\$299\/month/);
  assert.match(document.querySelector('#pilot').textContent, /One live source/i);
});

test('homepage keeps the sales path written and avoids unproven results', () => {
  const text = document.body.textContent;
  assert.match(text, /No sales call required/i);
  assert.match(text, /30-day scorecard/i);
  assert.doesNotMatch(text, /guaranteed revenue|increase conversions by|customers increased/i);
});

test.after(() => dom.window.close());
