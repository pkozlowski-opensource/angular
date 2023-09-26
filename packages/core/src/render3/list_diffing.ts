/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// TODO: name this file as list diffing or reconciliation?

export interface PrevCollection<T> {
  get length(): number;
  at(index: number): T;
  key(index: number): unknown;
  attach(index: number, item: T): void;
  detach(index: number): T;
  create(index: number, value: unknown): T;
  destroy(item: T): void;
}

export function reconcile<T>(
    prevCollection: PrevCollection<T>, newCollection: Readonly<ArrayLike<unknown>>,
    trackByFn: any) {
  let detachedItems: Map<unknown, T>|undefined = undefined;
  let existingInTheFutureItems: Map<unknown, T>|undefined = undefined;

  let oldStartIdx = 0;
  let oldEndIdx = prevCollection.length - 1;
  let newStartIdx = 0;
  let newEndIdx = newCollection.length - 1;

  // THINK: seems like the trackBy function would be invoked on the same item multiple times - can I
  // do better? Ideas:
  // - store it on the context?
  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    // compare from the beginning
    const oldKeyStart = prevCollection.key(oldStartIdx);
    const newKeyStart = trackByFn(newStartIdx, newCollection[newStartIdx]);
    if (Object.is(oldKeyStart, newKeyStart)) {
      oldStartIdx++;
      newStartIdx++;
      // TODO: but should I deal with the identity changes in here at all?
      // TODO: similar logic for other places where I skip through a view => add tests (!!!)
      // oldViewStart[CONTEXT].$implicit = newItemStart;
      continue;
    }

    // compare from the end
    // THINK: off-by-1 errors and CONTAINER_HEADER_OFFSET are really easy to get wrong -
    // alternatives? Maybe a wrapper
    const oldKeyEnd = prevCollection.key(oldEndIdx);
    const newKeyEnd = trackByFn(newEndIdx, newCollection[newEndIdx]);
    if (Object.is(oldKeyEnd, newKeyEnd)) {
      newEndIdx--;
      oldEndIdx--;
      continue;
    }

    // TODO: I'm probably swapping for nothing with myself?
    // swap on both ends
    if (Object.is(newKeyStart, oldKeyEnd) && Object.is(newKeyEnd, oldKeyStart)) {
      swapItemsInCollection(prevCollection, newStartIdx, oldEndIdx);
      newStartIdx++;
      newEndIdx--;
      oldStartIdx++;
      oldEndIdx--;
      continue;
    }

    // Fallback to the slow path.
    if (detachedItems === undefined) {
      detachedItems = new Map();
    }
    if (existingInTheFutureItems === undefined) {
      existingInTheFutureItems = new Map();
      for (let i = oldStartIdx; i <= oldEndIdx; i++) {
        existingInTheFutureItems.set(prevCollection.key(i), prevCollection.at(i));
      }
    }

    // Check if I'm inserting a previously detached item:
    // - if so, attach it here
    if (detachedItems.has(newKeyStart)) {
      prevCollection.attach(oldStartIdx, detachedItems.get(newKeyStart)!);
      detachedItems.delete(newKeyStart);
      oldStartIdx++
      oldEndIdx++;
      newStartIdx++;

    } else {
      if (!existingInTheFutureItems.has(newKeyStart)) {
        // the item in question must be created since it doesn't exists in the old collection
        const newItem = prevCollection.create(newStartIdx, newCollection[newStartIdx]);
        prevCollection.attach(newStartIdx, newItem);
        existingInTheFutureItems.delete(newKeyStart);

        oldStartIdx++
        oldEndIdx++;
        newStartIdx++;

      } else {
        // We know that the new item exists later on in old collection but we don't know its index
        // and as the consequence can't move it (don't know where to find it). Options:
        // - detach the old item, hoping that it unlocks the fast path (current approach)
        // - leave a "marker item" and re-connect when we find the match
        const notMatchingKey = prevCollection.key(oldStartIdx);
        detachedItems.set(notMatchingKey, prevCollection.detach(oldStartIdx));

        oldEndIdx--;
      }
    }
  }

  // Final cleanup steps:
  // - more items in the new collection => insert
  while (newStartIdx <= newEndIdx) {
    const newItemKey = trackByFn(newStartIdx, newCollection[newStartIdx]);
    if (detachedItems !== undefined && detachedItems.has(newItemKey)) {
      prevCollection.attach(newStartIdx, detachedItems.get(newItemKey)!);
      detachedItems.delete(newItemKey);
    } else {
      const newItem = prevCollection.create(newStartIdx, newCollection[newStartIdx]);
      prevCollection.attach(newStartIdx, newItem);
    }

    newStartIdx++;
  }

  // - more items in the previous collection => delete starting from the end
  while (oldStartIdx <= oldEndIdx) {
    const item = prevCollection.destroy(prevCollection.detach(oldEndIdx));
    oldEndIdx--;
  }

  // - destroy items that were detached but never attached again
  if (detachedItems !== undefined) {
    for (const item of detachedItems.values()) {
      prevCollection.destroy(item);
    }
  }

  // TESTS to write:
  // - duplicated keys => what should happen here? Careful - throwing in the dev mode is not
  // sufficient as production data might change the equation
  // - not an array => what should happen here? fallback to a different algo? Or just throw?
}

function swapItemsInCollection(
    prevCollection: PrevCollection<unknown>, startIdx: number, endIdx: number) {
  if (endIdx - startIdx < 1) {
    // TODO: proper assert
    throw new Error('should never happen');
  }
  const endItem = prevCollection.detach(endIdx);
  if (endIdx - startIdx > 1) {
    const startItem = prevCollection.detach(startIdx);
    prevCollection.attach(startIdx, endItem);
    prevCollection.attach(endIdx, startItem);
  } else if (endIdx - startIdx) {
    prevCollection.attach(startIdx, endItem);
  }
}
