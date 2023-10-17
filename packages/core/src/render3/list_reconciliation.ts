/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {TrackByFunction} from '../change_detection';
import {assertNotSame} from '../util/assert';

/**
 * A type representing the live collection to be reconciled with any new (incoming) collection. This
 * is an adapter class that makes it possible to work with different internal data structures,
 * regardless of the actual values of the incoming collection.
 */
export abstract class LiveCollection<T, V> {
  abstract get length(): number;
  abstract at(index: number): V;
  abstract attach(index: number, item: T): void;
  abstract detach(index: number): T;
  abstract create(index: number, value: V): T;
  destroy(item: T): void {
    // noop by default
  }
  updateValue(index: number, value: V): void {
    // noop by default
  }

  // operations below could be implemented on top of the operations defined so far, but having
  // them explicitly allow clear expression of intent and potentially more performant
  // implementations
  swap(index1: number, index2: number): void {
    const startIdx = Math.min(index1, index2);
    const endIdx = Math.max(index1, index2);
    const endItem = this.detach(endIdx);
    if (endIdx - startIdx > 1) {
      const startItem = this.detach(startIdx);
      this.attach(startIdx, endItem);
      this.attach(endIdx, startItem);
    } else {
      this.attach(startIdx, endItem);
    }
  }
  move(prevIndex: number, newIdx: number): void {
    this.attach(newIdx, this.detach(prevIndex));
  }
}

function valuesMatching<V>(
    liveIdx: number, liveValue: V, newIdx: number, newValue: V,
    trackBy: TrackByFunction<V>): number {
  if (liveIdx === newIdx && Object.is(liveValue, newValue)) {
    // matching and no value identity to update
    return 1;
  } else if (Object.is(trackBy(liveIdx, liveValue), trackBy(newIdx, newValue))) {
    // matching but requires value identity update
    return -1;
  }

  return 0;
}

/**
 * The live collection reconciliation algorithm that perform various in-place operations, so it
 * reflects the content of the new (incoming) collection.
 *
 * The reconciliation algorithm has 2 code paths:
 * - "fast" path that don't require any memory allocation;
 * - "slow" path that requires additional memory allocation for intermediate data structures used to
 * collect additional information about the live collection.
 * It might happen that the algorithm switches between the two modes in question in a single
 * reconciliation path - generally it tries to stay on the "fast" path as much as possible.
 *
 * The overall complexity of the algorithm is O(n + m) for speed and O(n) for memory (where n is the
 * length of the live collection and m is the length of the incoming collection). Given the problem
 * at hand the complexity / performance constraints makes it impossible to perform the absolute
 * minimum of operation to reconcile the 2 collections. The algorithm makes different tradeoffs to
 * stay within reasonable performance bounds and may apply sub-optimal number of operations in
 * certain situations.
 *
 * @param liveCollection the current, live collection;
 * @param newCollection the new, incoming collection;
 * @param trackByFn key generation function that determines equality between items in the life and
 *     incoming collection;
 */
export function reconcile<T, V>(
    liveCollection: LiveCollection<T, V>, newCollection: Iterable<V>|undefined|null,
    trackByFn: TrackByFunction<V>): void {
  let detachedItems: UniqueValueMultiKeyMap<unknown, T>|undefined = undefined;
  let liveKeysInTheFuture: Set<unknown>|undefined = undefined;

  let liveStartIdx = 0;
  let liveEndIdx = liveCollection.length - 1;

  if (Array.isArray(newCollection)) {
    let newEndIdx = newCollection.length - 1;

    while (liveStartIdx <= liveEndIdx && liveStartIdx <= newEndIdx) {
      // compare from the beginning
      const liveStartValue = liveCollection.at(liveStartIdx);
      const newStartValue = newCollection[liveStartIdx];
      const isStartMatching =
          valuesMatching(liveStartIdx, liveStartValue, liveStartIdx, newStartValue, trackByFn);
      if (isStartMatching !== 0) {
        if (isStartMatching < 0) {
          liveCollection.updateValue(liveStartIdx, newStartValue);
        }
        liveStartIdx++;
        continue;
      }

      // compare from the end
      // TODO(perf): do _all_ the matching from the end
      const liveEndValue = liveCollection.at(liveEndIdx);
      const newEndValue = newCollection[newEndIdx];
      const isEndMatching =
          valuesMatching(liveEndIdx, liveEndValue, newEndIdx, newEndValue, trackByFn);
      if (isEndMatching !== 0) {
        if (isEndMatching < 0) {
          liveCollection.updateValue(liveEndIdx, newEndValue);
        }
        liveEndIdx--;
        newEndIdx--;
        continue;
      }

      // Detect swap and moves:
      const liveStartKey = trackByFn(liveStartIdx, liveStartValue);
      const liveEndKey = trackByFn(liveEndIdx, liveEndValue);
      const newStartKey = trackByFn(liveStartIdx, newStartValue);
      if (Object.is(newStartKey, liveEndKey)) {
        const newEndKey = trackByFn(newEndIdx, newEndValue);
        // detect swap on both ends;
        if (Object.is(newEndKey, liveStartKey)) {
          liveCollection.swap(liveStartIdx, liveEndIdx);
          liveCollection.updateValue(liveEndIdx, newEndValue);
          newEndIdx--;
          liveEndIdx--;
        } else {
          // the new item is the same as the live item with the end pointer - this is a move forward
          // to an earlier index;
          liveCollection.move(liveEndIdx, liveStartIdx);
        }
        liveCollection.updateValue(liveStartIdx, newStartValue);
        liveStartIdx++;
        continue;
      }

      // Fallback to the slow path: we need to learn more about the content of the live and new
      // collections.
      detachedItems ??= new UniqueValueMultiKeyMap();
      liveKeysInTheFuture ??=
          initLiveItemsInTheFuture(liveCollection, liveStartIdx, liveEndIdx, trackByFn);

      // Check if I'm inserting a previously detached item: if so, attach it here
      if (attachPreviouslyDetached(liveCollection, detachedItems, liveStartIdx, newStartKey)) {
        liveCollection.updateValue(liveStartIdx, newStartValue);
        liveStartIdx++;
        liveEndIdx++;
      } else if (!liveKeysInTheFuture.has(newStartKey)) {
        // Check if we seen a new item that doesn't exist in the old collection and must be INSERTED
        const newItem = liveCollection.create(liveStartIdx, newCollection[liveStartIdx]);
        liveCollection.attach(liveStartIdx, newItem);
        liveStartIdx++;
        liveEndIdx++;
      } else {
        // We know that the new item exists later on in old collection but we don't know its index
        // and as the consequence can't move it (don't know where to find it). Detach the old item,
        // hoping that it unlocks the fast path again.
        detachedItems.set(liveStartKey, liveCollection.detach(liveStartIdx));
        liveEndIdx--;
      }
    }

    // Final cleanup steps:
    // - more items in the new collection => insert
    while (liveStartIdx <= newEndIdx) {
      createOrAttach(
          liveCollection, detachedItems, trackByFn, liveStartIdx, newCollection[liveStartIdx]);
      liveStartIdx++;
    }

  } else if (newCollection != null) {
    // iterable - immediately fallback to the slow path
    const newCollectionIterator = newCollection[Symbol.iterator]();
    let newIterationResult = newCollectionIterator.next();
    while (!newIterationResult.done && liveStartIdx <= liveEndIdx) {
      const liveValue = liveCollection.at(liveStartIdx);
      const newValue = newIterationResult.value;
      const isStartMatching =
          valuesMatching(liveStartIdx, liveValue, liveStartIdx, newValue, trackByFn);
      if (isStartMatching !== 0) {
        // found a match - move on, but update value
        if (isStartMatching < 0) {
          liveCollection.updateValue(liveStartIdx, newValue);
        }
        liveStartIdx++;
        newIterationResult = newCollectionIterator.next();
      } else {
        detachedItems ??= new UniqueValueMultiKeyMap();
        liveKeysInTheFuture ??=
            initLiveItemsInTheFuture(liveCollection, liveStartIdx, liveEndIdx, trackByFn);

        // Check if I'm inserting a previously detached item: if so, attach it here
        const newKey = trackByFn(liveStartIdx, newValue);
        if (attachPreviouslyDetached(liveCollection, detachedItems, liveStartIdx, newKey)) {
          liveCollection.updateValue(liveStartIdx, newValue);
          liveStartIdx++;
          liveEndIdx++;
          newIterationResult = newCollectionIterator.next();
        } else if (!liveKeysInTheFuture.has(newKey)) {
          liveCollection.attach(liveStartIdx, liveCollection.create(liveStartIdx, newValue));
          liveStartIdx++;
          liveEndIdx++;
          newIterationResult = newCollectionIterator.next();
        } else {
          // it is a move forward - detach the current item without advancing in collections
          const liveKey = trackByFn(liveStartIdx, liveValue);
          detachedItems.set(liveKey, liveCollection.detach(liveStartIdx));
          liveEndIdx--;
        }
      }
    }

    // this is a new item as we run out of the items in the old collection - create or attach a
    // previously detached one
    while (!newIterationResult.done) {
      createOrAttach(
          liveCollection, detachedItems, trackByFn, liveCollection.length,
          newIterationResult.value);
      newIterationResult = newCollectionIterator.next();
    }
  }

  // Cleanups common to the array and iterable:
  // - more items in the live collection => delete starting from the end;
  while (liveStartIdx <= liveEndIdx) {
    liveCollection.destroy(liveCollection.detach(liveEndIdx--));
  }


  // - destroy items that were detached but never attached again.
  detachedItems?.forEach(item => {
    liveCollection.destroy(item);
  });
}

function attachPreviouslyDetached<T, V>(
    prevCollection: LiveCollection<T, V>,
    detachedItems: UniqueValueMultiKeyMap<unknown, T>|undefined, index: number,
    key: unknown): boolean {
  if (detachedItems !== undefined && detachedItems.has(key)) {
    prevCollection.attach(index, detachedItems.get(key)!);
    detachedItems.delete(key);
    return true;
  }
  return false;
}

function createOrAttach<T, V>(
    liveCollection: LiveCollection<T, V>,
    detachedItems: UniqueValueMultiKeyMap<unknown, T>|undefined,
    trackByFn: TrackByFunction<unknown>, index: number, value: V) {
  if (!attachPreviouslyDetached(liveCollection, detachedItems, index, trackByFn(index, value))) {
    const newItem = liveCollection.create(index, value);
    liveCollection.attach(index, newItem);
  } else {
    liveCollection.updateValue(index, value);
  }
}

function initLiveItemsInTheFuture<T>(
    liveCollection: LiveCollection<unknown, unknown>, start: number, end: number,
    trackByFn: TrackByFunction<unknown>): Set<unknown> {
  const keys = new Set();
  for (let i = start; i <= end; i++) {
    keys.add(trackByFn(i, liveCollection.at(i)));
  }
  return keys;
}

/**
 * A specific, partial implementation of the Map interface with the following characteristics:
 * - allows multiple values for a given key;
 * - maintain FIFO order for multiple values corresponding to a given key;
 * - assumes that all values are unique.
 *
 * The implementation aims at having the minimal overhead for cases where keys are _not_ duplicated
 * (the most common case in the list reconciliation algorithm). To achieve this, the first value for
 * a given key is stored in a regular map. Then, when more values are set for a given key, we
 * maintain a kind of linked list in a separate map. To maintain this linked list we assume that all
 * values (in the entire collection) are unique.
 */
export class UniqueValueMultiKeyMap<K, V> {
  private kvMap = new Map<K, V>();
  private _vMap: Map<V, V>|undefined = undefined;

  private get vMap() {
    return this._vMap ??= new Map<V, V>();
  }

  has(key: K): boolean {
    return this.kvMap.has(key);
  }

  delete(key: K): boolean {
    if (!this.has(key)) return false;

    const value = this.kvMap.get(key)!;
    if (this.vMap.has(value)) {
      this.kvMap.set(key, this.vMap.get(value)!);
      this.vMap.delete(value);
    } else {
      this.kvMap.delete(key);
    }

    return true;
  }

  get(key: K): V|undefined {
    return this.kvMap.get(key);
  }

  set(key: K, value: V): void {
    if (this.kvMap.has(key)) {
      let prevValue = this.kvMap.get(key)!;
      ngDevMode &&
          assertNotSame(
              prevValue, value, `Detected a duplicated value ${value} for the key ${key}`);
      while (this.vMap.has(prevValue)) {
        prevValue = this.vMap.get(prevValue)!;
      }
      this.vMap.set(prevValue, value);
    } else {
      this.kvMap.set(key, value);
    }
  }

  forEach(cb: (v: V, k: K) => void) {
    for (let [key, value] of this.kvMap) {
      cb(value, key);
      if (this._vMap !== undefined) {
        while (this.vMap.has(value)) {
          value = this.vMap.get(value)!;
          cb(value, key);
        }
      }
    }
  }
}
