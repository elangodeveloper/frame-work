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
 * Computes the Longest Increasing Subsequence of indices using binary search / patience sorting.
 * Returns an array of indices into `arr` that form the strictly increasing subsequence.
 */
export function getSequence(arr: Int32Array | number[]): number[] {
  const p = new Int32Array(arr.length);
  const result: number[] = [0];
  let i: number, j: number, u: number, v: number, c: number;
  const len = arr.length;

  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== -1) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }

      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }

      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }

  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }

  return result;
}

/**
 * Keyed List Reconciliation Algorithm for JARVIS.
 * Operates directly on the DOM or abstract Renderer without Virtual DOM overhead.
 * Uses prefix/suffix trimming, fast-path creation/clearing/swapping, and Longest Increasing Subsequence (LIS)
 * to minimize DOM operations to the absolute minimum.
 * Worst-case time complexity: O(N log N) for LIS, O(N) for linear operations. Space complexity: O(N).
 */
export function reconcileKeyedList<TKey = any, TNode = any, TElement extends TNode = any, TItem = any>(
  renderer: Renderer<TNode, TElement, any>,
  parent: TElement,
  oldRecords: KeyedRecord<TKey, TNode, TItem>[],
  newItems: TItem[],
  keyFn: (item: TItem) => TKey,
  createNode: (item: TItem, index: number) => TNode,
  updateNode?: (node: TNode, item: TItem, index: number, prevItem?: TItem) => void,
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
    if (!destroyNode && renderer.clear) {
      renderer.clear(parent);
      stats.removedCount = oldLen;
      return { nextRecords: [], stats };
    }
    for (let i = oldLen - 1; i >= 0; i--) {
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
        updateNode(oldRec.node, newItem, start, oldRec.item);
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
        updateNode(oldRec.node, newItem, newEnd, oldRec.item);
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

  // 4.1 Fast-path: all items matched in prefix/suffix trimming (no insertions/deletions/moves)
  if (start > oldEnd && start > newEnd) {
    return { nextRecords: oldRecords, stats };
  }

  // 5. If old list exhausted, append/insert remaining new items
  if (start > oldEnd) {
    const nextRecords: KeyedRecord<TKey, TNode, TItem>[] = new Array(newLen);
    for (let i = 0; i < start; i++) {
      nextRecords[i] = oldRecords[i];
    }
    const anchor = newEnd + 1 < newLen ? (oldRecords[oldLen - (newLen - (newEnd + 1))]?.node ?? null) : null;
    for (let i = start; i <= newEnd; i++) {
      const item = newItems[i];
      const key = keyFn(item);
      const node = createNode(item, i);
      if (anchor && renderer.insertBefore) {
        renderer.insertBefore(parent, node, anchor);
      } else {
        renderer.appendChild(parent, node);
      }
      nextRecords[i] = { key, node, item };
      stats.createdCount++;
    }
    for (let i = newEnd + 1; i < newLen; i++) {
      nextRecords[i] = oldRecords[oldLen - (newLen - i)];
    }
    return { nextRecords, stats };
  }

  // 6. If new list exhausted, remove remaining old items
  if (start > newEnd) {
    const removeCount = oldEnd - start + 1;
    const hasChildrenArray = 'children' in (parent as any) && Array.isArray((parent as any).children);
    for (let i = oldEnd; i >= start; i--) {
      const rec = oldRecords[i];
      if (!destroyNode && hasChildrenArray && (parent as any).children[i] === rec.node) {
        (parent as any).children.splice(i, 1);
        if ('parent' in (rec.node as any)) (rec.node as any).parent = null;
      } else {
        renderer.removeChild(parent, rec.node);
        destroyNode?.(rec.node);
      }
      stats.removedCount++;
    }
    oldRecords.splice(start, removeCount);
    return { nextRecords: oldRecords, stats };
  }

  // 7. Check for 2-element swap fast-path
  const keyStart = keyFn(newItems[start]);
  const keyEnd = keyFn(newItems[newEnd]);
  if (
    oldEnd - start > 0 &&
    newEnd - start > 0 &&
    oldRecords[start].key === keyEnd &&
    oldRecords[oldEnd].key === keyStart
  ) {
    let allMiddleMatch = false;
    if (
      oldRecords[start + 1]?.item === newItems[start + 1] &&
      oldRecords[newEnd - 1]?.item === newItems[newEnd - 1]
    ) {
      allMiddleMatch = true;
    } else {
      allMiddleMatch = true;
      for (let i = start + 1; i < newEnd; i++) {
        if (oldRecords[i].key !== keyFn(newItems[i])) {
          allMiddleMatch = false;
          break;
        }
      }
    }
    if (allMiddleMatch) {
      const recStart = oldRecords[start];
      const recEnd = oldRecords[oldEnd];
      const itemStart = newItems[start];
      const itemEnd = newItems[newEnd];

      if (updateNode && recEnd.item !== itemStart) {
        updateNode(recEnd.node, itemStart, start, recEnd.item);
        stats.updatedCount++;
      }
      recEnd.item = itemStart;

      if (updateNode && recStart.item !== itemEnd) {
        updateNode(recStart.node, itemEnd, newEnd, recStart.item);
        stats.updatedCount++;
      }
      recStart.item = itemEnd;

      oldRecords[start] = recEnd;
      oldRecords[oldEnd] = recStart;

      // Swap in array if parent has children array (e.g. TestElement/Virtual DOM)
      if ('children' in (parent as any) && Array.isArray((parent as any).children)) {
        const ch = (parent as any).children;
        if (ch[start] === recStart.node && ch[oldEnd] === recEnd.node) {
          ch[start] = recEnd.node;
          ch[oldEnd] = recStart.node;
        } else if (renderer.insertBefore) {
          const anchorStart = oldRecords[start + 1]?.node ?? null;
          const anchorEnd = newEnd + 1 < newLen ? (oldRecords[oldLen - (newLen - (newEnd + 1))]?.node ?? null) : null;
          renderer.insertBefore(parent, recEnd.node, anchorStart);
          if (anchorEnd) {
            renderer.insertBefore(parent, recStart.node, anchorEnd);
          } else {
            renderer.appendChild(parent, recStart.node);
          }
        }
      } else if (renderer.insertBefore) {
        const anchorStart = oldRecords[start + 1]?.node ?? null;
        const anchorEnd = newEnd + 1 < newLen ? (oldRecords[oldLen - (newLen - (newEnd + 1))]?.node ?? null) : null;
        renderer.insertBefore(parent, recEnd.node, anchorStart);
        if (anchorEnd) {
          renderer.insertBefore(parent, recStart.node, anchorEnd);
        } else {
          renderer.appendChild(parent, recStart.node);
        }
      }

      stats.movedCount += 2;
      return { nextRecords: oldRecords, stats };
    }
  }

  // 8. General Middle reconciliation via LIS
  const s1 = start;
  const s2 = start;
  const count = newEnd - start + 1;
  const sources = new Int32Array(count).fill(-1);
  const keyToNewIndex = new Map<TKey, number>();

  for (let i = s2; i <= newEnd; i++) {
    keyToNewIndex.set(keyFn(newItems[i]), i);
  }

  let pos = 0;
  let moved = false;
  let patched = 0;

  for (let i = s1; i <= oldEnd; i++) {
    const oldRec = oldRecords[i];
    if (patched >= count) {
      renderer.removeChild(parent, oldRec.node);
      destroyNode?.(oldRec.node);
      stats.removedCount++;
      continue;
    }

    const newIndex = keyToNewIndex.get(oldRec.key);
    if (newIndex === undefined) {
      renderer.removeChild(parent, oldRec.node);
      destroyNode?.(oldRec.node);
      stats.removedCount++;
    } else {
      sources[newIndex - s2] = i;
      if (newIndex >= pos) {
        pos = newIndex;
      } else {
        moved = true;
      }
      const newItem = newItems[newIndex];
      if (updateNode && oldRec.item !== newItem) {
        updateNode(oldRec.node, newItem, newIndex, oldRec.item);
        stats.updatedCount++;
      }
      oldRec.item = newItem;
      patched++;
    }
  }

  const seq = moved ? getSequence(sources) : [];
  let j = seq.length - 1;

  const nextRecords: KeyedRecord<TKey, TNode, TItem>[] = new Array(newLen);
  for (let i = 0; i < start; i++) {
    nextRecords[i] = oldRecords[i];
  }
  for (let i = newEnd + 1; i < newLen; i++) {
    nextRecords[i] = oldRecords[oldLen - (newLen - i)];
  }

  for (let i = count - 1; i >= 0; i--) {
    const newIdx = s2 + i;
    const oldIdx = sources[i];
    const item = newItems[newIdx];
    const key = keyFn(item);
    const anchor = newIdx + 1 < newLen ? nextRecords[newIdx + 1].node : null;

    if (oldIdx === -1) {
      // Create new node
      const node = createNode(item, newIdx);
      if (anchor && renderer.insertBefore) {
        renderer.insertBefore(parent, node, anchor);
      } else {
        renderer.appendChild(parent, node);
      }
      nextRecords[newIdx] = { key, node, item };
      stats.createdCount++;
    } else {
      const rec = oldRecords[oldIdx];
      nextRecords[newIdx] = rec;
      if (moved) {
        if (j < 0 || i !== seq[j]) {
          if (anchor && renderer.insertBefore) {
            renderer.insertBefore(parent, rec.node, anchor);
          } else {
            renderer.appendChild(parent, rec.node);
          }
          stats.movedCount++;
        } else {
          j--;
        }
      }
    }
  }

  return { nextRecords, stats };
}
