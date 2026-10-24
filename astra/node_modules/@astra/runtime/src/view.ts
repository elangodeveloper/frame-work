export interface View<TRoot = any> {
  root: TRoot;
  disposers: (() => void)[];
  destroy(): void;
}

export class ComponentView<TRoot = any> implements View<TRoot> {
  root: TRoot;
  disposers: (() => void)[] = [];

  constructor(root: TRoot) {
    this.root = root;
  }

  destroy(): void {
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch (err) {
        console.error('Error during view disposal:', err);
      }
    }
    this.disposers = [];
  }
}
