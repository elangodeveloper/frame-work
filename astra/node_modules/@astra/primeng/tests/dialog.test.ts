import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../../packages/renderer/src/index.ts';
import { signal, flushJobs } from '../../../packages/reactive/src/index.ts';
import { JarvisDialog } from '../src/index.ts';

describe('JarvisDialog (<jarvis-p-dialog>) Adapter', () => {
  it('should render dialog mask in hidden state by default', () => {
    const renderer = new TestRenderer();
    const dialog = new JarvisDialog(renderer, {
      header: 'Edit Profile',
      visible: false,
    });

    const mask = dialog.getElement();
    assert.strictEqual(mask.tag, 'div');
    assert.strictEqual(mask.attributes.get('class'), 'p-dialog-mask');
    assert.strictEqual(mask.properties.get('style'), 'display: none;');
    assert.ok(mask.textContent.includes('Edit Profile'));
  });

  it('should open and close reactively via visible signal', () => {
    const renderer = new TestRenderer();
    const visible = signal(false);

    const dialog = new JarvisDialog(renderer, {
      header: 'Confirmation',
      visible,
    });

    let showCount = 0;
    let hideCount = 0;
    dialog.onShow.subscribe(() => { showCount++; });
    dialog.onHide.subscribe(() => { hideCount++; });

    const mask = dialog.getElement();
    assert.strictEqual(mask.properties.get('style'), 'display: none;');

    // Show dialog
    visible.set(true);
    flushJobs();

    assert.ok(mask.properties.get('style')?.includes('display: flex'));
    assert.strictEqual(showCount, 1);

    // Hide dialog
    visible.set(false);
    flushJobs();

    assert.strictEqual(mask.properties.get('style'), 'display: none;');
    assert.strictEqual(hideCount, 1);
  });

  it('should close on header close button click and emit events', () => {
    const renderer = new TestRenderer();
    const visible = signal(true);

    const dialog = new JarvisDialog(renderer, {
      header: 'Modal Window',
      visible,
    });

    let hideEmitted = false;
    let visibleChangeVal: boolean | null = null;
    dialog.onHide.subscribe(() => { hideEmitted = true; });
    dialog.visibleChange.subscribe((v) => { visibleChangeVal = v; });

    // Structure: mask -> dialog -> [header, content] -> header -> [title, closeBtn]
    const dialogCard = dialog.getElement().children[0];
    const header = (dialogCard as any).children[0];
    const closeBtn = (header as any).children[1];

    closeBtn.dispatch('click');

    assert.strictEqual(hideEmitted, true);
    assert.strictEqual(visibleChangeVal, false);
    assert.strictEqual(dialog.getElement().properties.get('style'), 'display: none;');
  });

  it('should reactively update header title', () => {
    const renderer = new TestRenderer();
    const titleSig = signal('Initial Title');

    const dialog = new JarvisDialog(renderer, {
      header: titleSig,
      visible: false,
    });

    assert.ok(dialog.getElement().textContent.includes('Initial Title'));

    titleSig.set('Updated Header Title');
    flushJobs();

    assert.ok(dialog.getElement().textContent.includes('Updated Header Title'));
  });
});
