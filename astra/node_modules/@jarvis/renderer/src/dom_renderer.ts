import type { Renderer } from './renderer.ts';
import { effect } from '../../reactive/src/index.ts';

/**
 * Concrete browser DOM renderer implementation.
 */
export class DOMRenderer implements Renderer<Node, Element, Text> {
  createElement(tag: string): Element {
    return document.createElement(tag);
  }

  createText(content = ''): Text {
    return document.createTextNode(content);
  }

  appendChild(parent: Element, child: Node): void {
    parent.appendChild(child);
  }

  removeChild(parent: Element, child: Node): void {
    parent.removeChild(child);
  }

  setAttribute(element: Element, name: string, value: string): void {
    element.setAttribute(name, value);
  }

  setProperty(element: Element, property: string, value: any): void {
    (element as any)[property] = value;
  }

  setText(textNode: Text, content: string): void {
    textNode.textContent = content;
  }

  bindText(textNode: Text, expressionFn: () => any): () => void {
    return effect(() => {
      const val = expressionFn();
      textNode.textContent = val != null ? String(val) : '';
    });
  }

  bindProperty(element: Element, property: string, expressionFn: () => any): () => void {
    return effect(() => {
      const val = expressionFn();
      (element as any)[property] = val;
    });
  }

  listen(element: Element, event: string, handler: (event: any) => void): () => void {
    element.addEventListener(event, handler);
    return () => element.removeEventListener(event, handler);
  }
}
