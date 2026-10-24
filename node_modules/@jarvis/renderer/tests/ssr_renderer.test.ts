import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { SSRRenderer, escapeHtml, sanitizeAttributeValue } from '../src/index.ts';

describe('Jarvis SSRRenderer & Sanitization', () => {
  test('should escape special HTML entities in text content', () => {
    const renderer = new SSRRenderer();
    const div = renderer.createElement('div');
    const text = renderer.createText('<script>alert("xss")</script> & "quotes"');
    renderer.appendChild(div, text);

    const html = renderer.renderToString(div);
    assert.strictEqual(
      html,
      '<div>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;</div>'
    );
  });

  test('should sanitize malicious javascript: URLs in href and src', () => {
    const renderer = new SSRRenderer();
    const a = renderer.createElement('a');
    renderer.setAttribute(a, 'href', 'javascript:alert(1)');
    renderer.appendChild(a, renderer.createText('Click me'));

    const html = renderer.renderToString(a);
    assert.ok(html.includes('href="unsafe:javascript:alert(1)"'));
  });

  test('should render self-closing void elements without child tags', () => {
    const renderer = new SSRRenderer();
    const img = renderer.createElement('img');
    renderer.setAttribute(img, 'src', 'https://example.com/pic.png');
    renderer.setAttribute(img, 'alt', 'Photo');

    const html = renderer.renderToString(img);
    assert.strictEqual(html, '<img src="https://example.com/pic.png" alt="Photo" />');
  });

  test('should render nested component subtree hierarchy to string', () => {
    const renderer = new SSRRenderer();
    const container = renderer.createElement('div');
    renderer.setAttribute(container, 'class', 'container');

    const h1 = renderer.createElement('h1');
    renderer.appendChild(h1, renderer.createText('Welcome'));
    renderer.appendChild(container, h1);

    const p = renderer.createElement('p');
    renderer.appendChild(p, renderer.createText('Server-rendered content'));
    renderer.appendChild(container, p);

    const html = renderer.renderToString(container);
    assert.strictEqual(
      html,
      '<div class="container"><h1>Welcome</h1><p>Server-rendered content</p></div>'
    );
  });
});
