import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://www.arvinify.com/' });
const { document } = dom.window;

test('homepage presents a LinkedIn-first pilot for the United States and Canada', () => {
  assert.match(document.title, /LinkedIn-to-Revenue/i);
  assert.match(document.querySelector('h1').textContent, /LinkedIn attention/i);
  assert.match(document.querySelector('#pilot').textContent, /US\$995/);
  assert.match(document.querySelector('#pilot').textContent, /C\$1,250/);
  assert.match(document.querySelector('#pilot').textContent, /US\$249\/month/);
  assert.match(document.querySelector('#pilot').textContent, /C\$299\/month/);
  assert.ok(document.querySelector('a[href^="/buy"]'));
});

test('homepage keeps the sales path written and avoids unproven results', () => {
  const text = document.body.textContent;
  assert.match(text, /No sales call required/i);
  assert.match(text, /30-day scorecard/i);
  assert.match(text, /scraping, mass DMs/i);
  assert.doesNotMatch(text, /guaranteed revenue|increase conversions by|customers increased/i);
});

test.after(() => dom.window.close());
