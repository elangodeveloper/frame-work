import type { Renderer } from './renderer.ts';
import { effect } from '../../reactive/src/index.ts';

export class TestNode {
  parent: TestElement | null = null;
}

export class TestElement extends TestNode {
  readonly tag: string;
  readonly children: TestNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly properties = new Map<string, any>();
  readonly listeners = new Map<string, Set<(event: any) => void>>();

  constructor(tag: string) {
    super();
    this.tag = tag;
  }

  get textContent(): string {
    return this.children
      .map((c) => (c instanceof TestText ? c.content : c instanceof TestElement ? c.textContent : ''))
      .join('');
  }

  set textContent(value: string) {
    this.children.length = 0;
    if (value) {
      const textNode = new TestText(value);
      textNode.parent = this;
      this.children.push(textNode);
    }
  }

  set innerHTML(value: string) {
    this.children.length = 0;
    if (value) {
      // Basic strip of HTML tags or store representation for testing
      const clean = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const textNode = new TestText(clean);
      textNode.parent = this;
      this.children.push(textNode);
    }
  }

  dispatch(event: string, eventObj: any = {}): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(eventObj);
      }
    }
  }

  toHtml(): string {
    let attrs = '';
    for (const [k, v] of this.attributes) {
      attrs += ` ${k}="${v}"`;
    }
    const inner = this.children
      .map((c) => (c instanceof TestText ? c.content : c instanceof TestElement ? c.toHtml() : ''))
      .join('');
    return `<${this.tag}${attrs}>${inner}</${this.tag}>`;
  }
}

export class TestText extends TestNode {
  content: string;

  constructor(content = '') {
    super();
    this.content = content;
  }
}

/**
 * In-memory test renderer that operates in Node.js environments without a real DOM.
 */
export class TestRenderer implements Renderer<TestNode, TestElement, TestText> {
  createElement(tag: string): TestElement {
    return new TestElement(tag);
  }

  createText(content = ''): TestText {
    return new TestText(content);
  }

  appendChild(parent: TestElement, child: TestNode): void {
    if (child.parent) {
      this.removeChild(child.parent, child);
    }
    child.parent = parent;
    parent.children.push(child);
  }

  removeChild(parent: TestElement, child: TestNode): void {
    const idx = parent.children.indexOf(child);
    if (idx !== -1) {
      parent.children.splice(idx, 1);
      child.parent = null;
    }
  }

  setAttribute(element: TestElement, name: string, value: string): void {
    element.attributes.set(name, value);
  }

  setProperty(element: TestElement, property: string, value: any): void {
    element.properties.set(property, value);
  }

  setText(textNode: any, content: string): void {
    if (textNode instanceof TestText) {
      textNode.content = content;
    } else if (textNode) {
      textNode.textContent = content;
    }
  }

  bindText(textNode: any, expressionFn: () => any): () => void {
    return effect(() => {
      const val = expressionFn();
      const str = val != null ? String(val) : '';
      if (textNode instanceof TestText) {
        textNode.content = str;
      } else if (textNode) {
        textNode.textContent = str;
      }
    });
  }

  bindProperty(element: TestElement, property: string, expressionFn: () => any): () => void {
    return effect(() => {
      const val = expressionFn();
      element.properties.set(property, val);
    });
  }

  listen(element: TestElement, event: string, handler: (event: any) => void): () => void {
    if (!element.listeners.has(event)) {
      element.listeners.set(event, new Set());
    }
    element.listeners.get(event)!.add(handler);

    return () => {
      element.listeners.get(event)?.delete(handler);
    };
  }
}
