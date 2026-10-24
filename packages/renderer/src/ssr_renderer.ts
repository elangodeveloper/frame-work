import type { Renderer } from './renderer.ts';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeAttributeValue(name: string, value: string): string {
  if (name === 'href' || name === 'src') {
    const trimmed = value.trim();
    if (/^(javascript:|data:text\/html)/i.test(trimmed)) {
      return 'unsafe:' + escapeHtml(value);
    }
  }
  return escapeHtml(value);
}

export class SSRNode {
  parent: SSRElement | null = null;
  toHtml(): string {
    return '';
  }
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

export class SSRElement extends SSRNode {
  readonly tag: string;
  readonly children: SSRNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly properties = new Map<string, any>();

  constructor(tag: string) {
    super();
    this.tag = tag.toLowerCase();
  }

  override toHtml(): string {
    let attrs = '';
    for (const [k, v] of this.attributes) {
      attrs += ` ${escapeHtml(k)}="${sanitizeAttributeValue(k, v)}"`;
    }
    for (const [k, v] of this.properties) {
      if (k === 'className' || k === 'class') {
        if (v && !this.attributes.has('class')) {
          attrs += ` class="${escapeHtml(String(v))}"`;
        }
      } else if (k === 'id' && !this.attributes.has('id')) {
        attrs += ` id="${escapeHtml(String(v))}"`;
      }
    }

    if (VOID_ELEMENTS.has(this.tag) && this.children.length === 0) {
      return `<${this.tag}${attrs} />`;
    }

    const inner = this.children.map((c) => c.toHtml()).join('');
    return `<${this.tag}${attrs}>${inner}</${this.tag}>`;
  }
}

export class SSRText extends SSRNode {
  content: string;

  constructor(content = '') {
    super();
    this.content = content;
  }

  override toHtml(): string {
    return escapeHtml(this.content);
  }
}

/**
 * Server-Side Renderer (SSR) producing escaped, secure HTML.
 */
export class SSRRenderer implements Renderer<SSRNode, SSRElement, SSRText> {
  createElement(tag: string): SSRElement {
    return new SSRElement(tag);
  }

  createText(content = ''): SSRText {
    return new SSRText(content);
  }

  appendChild(parent: SSRElement, child: SSRNode): void {
    if (child.parent) {
      this.removeChild(child.parent, child);
    }
    child.parent = parent;
    parent.children.push(child);
  }

  removeChild(parent: SSRElement, child: SSRNode): void {
    const idx = parent.children.indexOf(child);
    if (idx !== -1) {
      parent.children.splice(idx, 1);
      child.parent = null;
    }
  }

  setAttribute(element: SSRElement, name: string, value: string): void {
    element.attributes.set(name, value);
  }

  setProperty(element: SSRElement, property: string, value: any): void {
    element.properties.set(property, value);
    if (property === 'className' || property === 'class') {
      element.attributes.set('class', String(value ?? ''));
    }
  }

  setText(textNode: SSRText, content: string): void {
    textNode.content = content;
  }

  bindText(textNode: SSRText, expressionFn: () => any): () => void {
    try {
      const val = expressionFn();
      textNode.content = val != null ? String(val) : '';
    } catch {
      // Ignored during initial SSR pass
    }
    return () => {};
  }

  bindProperty(element: SSRElement, property: string, expressionFn: () => any): () => void {
    try {
      const val = expressionFn();
      this.setProperty(element, property, val);
    } catch {
      // Ignored during initial SSR pass
    }
    return () => {};
  }

  listen(_element: SSRElement, _event: string, _handler: (event: any) => void): () => void {
    // Events are no-ops in SSR
    return () => {};
  }

  renderToString(root: SSRNode): string {
    return root ? root.toHtml() : '';
  }
}
