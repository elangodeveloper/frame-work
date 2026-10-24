import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { TestRenderer, type TestNode } from '../src/test_renderer.ts';
import { reconcileKeyedList, type KeyedRecord } from '../src/keyed_reconciler.ts';

interface Item {
  id: number;
  text: string;
}

describe('JARVIS Keyed List Reconciliation Algorithm', () => {
  it('should handle initial population from empty array', () => {
    const renderer = new TestRenderer();
    const parent = renderer.createElement('ul');

    const items: Item[] = [
      { id: 1, text: 'Item 1' },
      { id: 2, text: 'Item 2' },
      { id: 3, text: 'Item 3' },
    ];

    const { nextRecords, stats } = reconcileKeyedList(
      renderer,
      parent,
      [],
      items,
      (item) => item.id,
      (item) => {
        const li = renderer.createElement('li');
        renderer.setText(renderer.createText(item.text), item.text);
        renderer.appendChild(li, renderer.createText(item.text));
        return li;
      }
    );

    assert.strictEqual(nextRecords.length, 3);
    assert.strictEqual(stats.createdCount, 3);
    assert.strictEqual(stats.removedCount, 0);
    assert.strictEqual(parent.children.length, 3);
  });

  it('should handle complete clear to empty array', () => {
    const renderer = new TestRenderer();
    const parent = renderer.createElement('ul');

    const node1 = renderer.createElement('li');
    const node2 = renderer.createElement('li');
    renderer.appendChild(parent, node1);
    renderer.appendChild(parent, node2);

    const oldRecords: KeyedRecord<number, TestNode, Item>[] = [
      { key: 1, node: node1, item: { id: 1, text: 'A' } },
      { key: 2, node: node2, item: { id: 2, text: 'B' } },
    ];

    const { nextRecords, stats } = reconcileKeyedList(
      renderer,
      parent,
      oldRecords,
      [],
      (item) => item.id,
      () => renderer.createElement('li')
    );

    assert.strictEqual(nextRecords.length, 0);
    assert.strictEqual(stats.removedCount, 2);
    assert.strictEqual(parent.children.length, 0);
  });

  it('should trim common prefix and suffix without recreating DOM nodes', () => {
    const renderer = new TestRenderer();
    const parent = renderer.createElement('ul');

    const liA = renderer.createElement('li');
    const liB = renderer.createElement('li');
    const liC = renderer.createElement('li');
    renderer.appendChild(parent, liA);
    renderer.appendChild(parent, liB);
    renderer.appendChild(parent, liC);

    const oldRecords: KeyedRecord<number, TestNode, Item>[] = [
      { key: 1, node: liA, item: { id: 1, text: 'A' } },
      { key: 2, node: liB, item: { id: 2, text: 'B' } },
      { key: 3, node: liC, item: { id: 3, text: 'C' } },
    ];

    // Replace middle item 'B' with 'X'
    const newItems: Item[] = [
      { id: 1, text: 'A' },
      { id: 99, text: 'X' },
      { id: 3, text: 'C' },
    ];

    const { nextRecords, stats } = reconcileKeyedList(
      renderer,
      parent,
      oldRecords,
      newItems,
      (item) => item.id,
      (item) => renderer.createElement('li')
    );

    assert.strictEqual(stats.preservedPrefixCount, 1, 'Head item A preserved');
    assert.strictEqual(stats.preservedSuffixCount, 1, 'Tail item C preserved');
    assert.strictEqual(stats.createdCount, 1, 'New item X created');
    assert.strictEqual(stats.removedCount, 1, 'Old item B removed');

    // Crucial: Node identity preservation!
    assert.strictEqual(nextRecords[0].node, liA);
    assert.strictEqual(nextRecords[2].node, liC);
  });

  it('should reuse existing nodes when items are reordered or swapped', () => {
    const renderer = new TestRenderer();
    const parent = renderer.createElement('ul');

    const li1 = renderer.createElement('li');
    const li2 = renderer.createElement('li');
    const li3 = renderer.createElement('li');
    renderer.appendChild(parent, li1);
    renderer.appendChild(parent, li2);
    renderer.appendChild(parent, li3);

    const oldRecords: KeyedRecord<number, TestNode, Item>[] = [
      { key: 1, node: li1, item: { id: 1, text: '1' } },
      { key: 2, node: li2, item: { id: 2, text: '2' } },
      { key: 3, node: li3, item: { id: 3, text: '3' } },
    ];

    // Reverse list: [3, 2, 1]
    const newItems: Item[] = [
      { id: 3, text: '3' },
      { id: 2, text: '2' },
      { id: 1, text: '1' },
    ];

    const { nextRecords, stats } = reconcileKeyedList(
      renderer,
      parent,
      oldRecords,
      newItems,
      (item) => item.id,
      (item) => renderer.createElement('li')
    );

    assert.strictEqual(stats.createdCount, 0, 'Zero nodes created on reverse');
    assert.strictEqual(stats.removedCount, 0, 'Zero nodes destroyed on reverse');

    // All original nodes preserved in new order
    assert.strictEqual(nextRecords[0].node, li3);
    assert.strictEqual(nextRecords[1].node, li2);
    assert.strictEqual(nextRecords[2].node, li1);
  });
});
