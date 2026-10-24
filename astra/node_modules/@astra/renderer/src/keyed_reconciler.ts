import type { Renderer } from './renderer.ts';

export interface KeyedRecord<TKey = any, TNode = any, TItem = any> {
  key: TKey;
  node: TNode;
  item: TItem;
}

export interface ReconcilerStats {
  createdCount: number;
  removedCount: number;
  movedCount: number;
  updatedCount: number;
  preservedPrefixCount: number;
  preservedSuffixCount: number;
}

/**
 * Keyed List Reconciliation Algorithm for JARVIS.
 * Operates directly on the DOM or abstract Renderer without Virtual DOM overhead.
 * Uses head/tail prefix-suffix trimming and map-based displacement minimization.
 * Worst-case time complexity: O(N), space complexity: O(N).
 */
export function reconcileKeyedList<TKey = any, TNode = any, TElement extends TNode = any, TItem = any>(
  renderer: Renderer<TNode, TElement, any>,
  parent: TElement,
  oldRecords: KeyedRecord<TKey, TNode, TItem>[],
  newItems: TItem[],
  keyFn: (item: TItem) => TKey,
  createNode: (item: TItem, index: number) => TNode,
  updateNode?: (node: TNode, item: TItem, index: number) => void,
  destroyNode?: (node: TNode) => void
): { nextRecords: KeyedRecord<TKey, TNode, TItem>[]; stats: ReconcilerStats } {
  const stats: ReconcilerStats = {
    createdCount: 0,
    removedCount: 0,
    movedCount: 0,
    updatedCount: 0,
    preservedPrefixCount: 0,
    preservedSuffixCount: 0,
  };

  const newLen = newItems.length;
  const oldLen = oldRecords.length;

  // 1. Fast-path: initial population
  if (oldLen === 0) {
    const nextRecords: KeyedRecord<TKey, TNode, TItem>[] = new Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const item = newItems[i];
      const key = keyFn(item);
      const node = createNode(item, i);
      renderer.appendChild(parent, node);
      nextRecords[i] = { key, node, item };
      stats.createdCount++;
    }
    return { nextRecords, stats };
  }

  // 2. Fast-path: complete clear
  if (newLen === 0) {
    for (let i = 0; i < oldLen; i++) {
      const rec = oldRecords[i];
      renderer.removeChild(parent, rec.node);
      destroyNode?.(rec.node);
      stats.removedCount++;
    }
    return { nextRecords: [], stats };
  }

  let start = 0;
  let oldEnd = oldLen - 1;
  let newEnd = newLen - 1;

  // 3. Prefix trimming (common head items)
  while (start <= oldEnd && start <= newEnd) {
    const oldRec = oldRecords[start];
    const newItem = newItems[start];
    const newKey = keyFn(newItem);

    if (oldRec.key === newKey) {
      if (updateNode && oldRec.item !== newItem) {
        updateNode(oldRec.node, newItem, start);
        stats.updatedCount++;
      }
      oldRec.item = newItem;
      stats.preservedPrefixCount++;
      start++;
    } else {
      break;
    }
  }

  // 4. Suffix trimming (common tail items)
  while (start <= oldEnd && start <= newEnd) {
    const oldRec = oldRecords[oldEnd];
    const newItem = newItems[newEnd];
    const newKey = keyFn(newItem);

    if (oldRec.key === newKey) {
      if (updateNode && oldRec.item !== newItem) {
        updateNode(oldRec.node, newItem, newEnd);
        stats.updatedCount++;
      }
      oldRec.item = newItem;
      stats.preservedSuffixCount++;
      oldEnd--;
      newEnd--;
    } else {
      break;
    }
  }

  // 5. If old list exhausted, append/insert remaining new items
  if (start > oldEnd) {
    const nextRecords: KeyedRecord<TKey, TNode, TItem>[] = new Array(newLen);
    // Copy matched prefix
    for (let i = 0; i < start; i++) {
      nextRecords[i] = oldRecords[i];
    }
    // Create new items in middle
    for (let i = start; i <= newEnd; i++) {
      const item = newItems[i];
      const key = keyFn(item);
      const node = createNode(item, i);
      // Insert in DOM
      renderer.appendChild(parent, node);
      nextRecords[i] = { key, node, item };
      stats.createdCount++;
    }
    // Copy matched suffix
    for (let i = newEnd + 1; i < newLen; i++) {
      nextRecords[i] = oldRecords[oldLen - (newLen - i)];
    }
    return { nextRecords, stats };
  }

  // 6. If new list exhausted, remove remaining old items
  if (start > newEnd) {
    const nextRecords: KeyedRecord<TKey, TNode, TItem>[] = new Array(newLen);
    for (let i = 0; i < start; i++) {
      nextRecords[i] = oldRecords[i];
    }
    // Remove unmatched old items
    for (let i = start; i <= oldEnd; i++) {
      const rec = oldRecords[i];
      renderer.removeChild(parent, rec.node);
      destroyNode?.(rec.node);
      stats.removedCount++;
    }
    // Copy suffix
    for (let i = start; i < newLen; i++) {
      nextRecords[i] = oldRecords[oldLen - (newLen - i)];
    }
    return { nextRecords, stats };
  }

  // 7. Middle reconciliation via Map
  const keyToOldRecordMap = new Map<TKey, KeyedRecord<TKey, TNode, TItem>>();
  for (let i = start; i <= oldEnd; i++) {
    const rec = oldRecords[i];
    keyToOldRecordMap.set(rec.key, rec);
  }

  const nextRecords: KeyedRecord<TKey, TNode, TItem>[] = new Array(newLen);
  // Copy prefix
  for (let i = 0; i < start; i++) {
    nextRecords[i] = oldRecords[i];
  }

  // Traverse middle of new items
  for (let i = start; i <= newEnd; i++) {
    const newItem = newItems[i];
    const newKey = keyFn(newItem);
    const existingRec = keyToOldRecordMap.get(newKey);

    if (existingRec) {
      // Reuse node!
      keyToOldRecordMap.delete(newKey);
      if (updateNode && existingRec.item !== newItem) {
        updateNode(existingRec.node, newItem, i);
        stats.updatedCount++;
      }
      existingRec.item = newItem;
      nextRecords[i] = existingRec;
      stats.movedCount++;
    } else {
      // Create new node
      const node = createNode(newItem, i);
      renderer.appendChild(parent, node);
      nextRecords[i] = { key: newKey, node, item: newItem };
      stats.createdCount++;
    }
  }

  // Copy suffix
  for (let i = newEnd + 1; i < newLen; i++) {
    nextRecords[i] = oldRecords[oldLen - (newLen - i)];
  }

  // Destroy remaining unused old items
  for (const unusedRec of keyToOldRecordMap.values()) {
    renderer.removeChild(parent, unusedRec.node);
    destroyNode?.(unusedRec.node);
    stats.removedCount++;
  }

  return { nextRecords, stats };
}
