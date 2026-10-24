/**
 * Abstract rendering interface decoupling Jarvis from browser DOM APIs.
 */

export interface Renderer<TNode = any, TElement extends TNode = any, TText extends TNode = any> {
  createElement(tag: string): TElement;
  createText(content?: string): TText;
  appendChild(parent: TElement, child: TNode): void;
  removeChild(parent: TElement, child: TNode): void;
  setAttribute(element: TElement, name: string, value: string): void;
  setProperty(element: TElement, property: string, value: any): void;
  setText(textNode: TText, content: string): void;

  /**
   * Establishes a fine-grained reactive text binding.
   */
  bindText(textNode: TText, expressionFn: () => any): () => void;

  /**
   * Establishes a fine-grained reactive property binding.
   */
  bindProperty(element: TElement, property: string, expressionFn: () => any): () => void;

  /**
   * Attaches an event listener.
   */
  listen(element: TElement, event: string, handler: (event: any) => void): () => void;
}
