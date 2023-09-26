/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {PrevCollection, reconcile} from '@angular/core/src/render3/list_diffing';

class LoggingPrevCollection<T> implements PrevCollection<T> {
  private logs: any[][] = [];

  constructor(private arr: T[], private trackByFn: any) {}
  get length(): number {
    return this.arr.length;
  }
  at(index: number): T {
    // TODO: throw if undefined
    return this.arr.at(index)!;
  }
  key(index: number): unknown {
    return this.trackByFn(index, this.at(index));
  }
  attach(index: number, item: T): void {
    this.logs.push(['attach', index, item]);
    this.arr.splice(index, 0, item);
  }
  detach(index: number): T {
    const item = this.at(index);
    this.logs.push(['detach', index, item]);
    this.arr.splice(index, 1);
    return item;
  }
  create(index: number, item: T): T {
    this.logs.push(['create', index, item]);
    return item;
  }
  destroy(item: T): void {
    this.logs.push(['destroy', item]);
  }

  getCollection() {
    return this.arr;
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

function trackByIdentity<T>(index: number, item: T) {
  return item;
}

fdescribe('list reconciliation', () => {
  describe('fast path', () => {
    it('should do nothing if 2 lists are the same', () => {
      const pc = new LoggingPrevCollection(['a', 'b', 'c'], trackByIdentity);
      reconcile(pc, ['a', 'b', 'c'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['a', 'b', 'c']);
      expect(pc.getLogs()).toEqual([]);
    });

    it('should add items at the end', () => {
      const pc = new LoggingPrevCollection(['a', 'b'], trackByIdentity);
      reconcile(pc, ['a', 'b', 'c'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['a', 'b', 'c']);
      expect(pc.getLogs()).toEqual([['create', 2, 'c'], ['attach', 2, 'c']]);
    });

    it('should swap items', () => {
      const pc = new LoggingPrevCollection(['a', 'b', 'c'], trackByIdentity);
      reconcile(pc, ['c', 'b', 'a'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['c', 'b', 'a']);
      // TODO: think of expressing as swap
      expect(pc.getLogs()).toEqual([
        ['detach', 2, 'c'],
        ['detach', 0, 'a'],
        ['attach', 0, 'c'],
        ['attach', 2, 'a'],
      ]);
    });

    it('should should optimally swap adjacent items', () => {
      const pc = new LoggingPrevCollection(['a', 'b'], trackByIdentity);
      reconcile(pc, ['b', 'a'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['b', 'a']);
      expect(pc.getLogs()).toEqual([
        ['detach', 1, 'b'],
        ['attach', 0, 'b'],
      ]);
    });

    it('should delete items in the middle', () => {
      const pc = new LoggingPrevCollection(['a', 'x', 'b', 'c'], trackByIdentity);
      reconcile(pc, ['a', 'b', 'c'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['a', 'b', 'c']);
      expect(pc.getLogs()).toEqual([
        ['detach', 1, 'x'],
        ['destroy', 'x'],
      ]);
    });

    it('should delete items from the beginning', () => {
      const pc = new LoggingPrevCollection(['a', 'b', 'c'], trackByIdentity);
      reconcile(pc, ['c'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['c']);
      expect(pc.getLogs()).toEqual([
        ['detach', 1, 'b'],
        ['destroy', 'b'],
        ['detach', 0, 'a'],
        ['destroy', 'a'],
      ]);
    });

    it('should delete items from the end', () => {
      const pc = new LoggingPrevCollection(['a', 'b', 'c'], trackByIdentity);
      reconcile(pc, ['a'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['a']);
      expect(pc.getLogs()).toEqual([
        ['detach', 2, 'c'],
        ['destroy', 'c'],
        ['detach', 1, 'b'],
        ['destroy', 'b'],
      ]);
    });
  });

  describe('slow path', () => {
    it('should delete multiple items from the middle', () => {
      const pc = new LoggingPrevCollection(['a', 'x1', 'b', 'x2', 'c'], trackByIdentity);
      reconcile(pc, ['a', 'b', 'c'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['a', 'b', 'c']);
      expect(pc.getLogs()).toEqual([
        ['detach', 1, 'x1'],
        ['detach', 2, 'x2'],
        ['destroy', 'x2'],
        ['destroy', 'x1'],
      ]);
    });

    it('should go back to the fast path when start / end is different', () => {
      const pc = new LoggingPrevCollection(['s1', 'a', 'b', 'c', 'e1'], trackByIdentity);
      reconcile(pc, ['s2', 'a', 'b', 'c', 'e2'], trackByIdentity);

      expect(pc.getCollection()).toEqual(['s2', 'a', 'b', 'c', 'e2']);
      expect(pc.getLogs()).toEqual([
        // item gets created at index 0 since we know it is not in the old array
        ['create', 0, 's2'],
        ['attach', 0, 's2'],
        // item at index 1 gets detached since it doesn't match
        ['detach', 1, 's1'],
        // we are on the fast path again, skipping 'a', 'b', 'c'
        // item gets created at index 4 since we know it is not in the old array
        ['create', 4, 'e2'],
        ['attach', 4, 'e2'],
        // the rest gets detached / destroyed
        ['detach', 5, 'e1'],
        ['destroy', 'e1'],
        ['destroy', 's1'],
      ]);
    });

    fit('should expose slow path', () => {
      const pc = new LoggingPrevCollection(['a', 'b', 'c'], trackByIdentity);
      // problematic scenario: move to the front
      reconcile(pc, ['c', 'a', 'b'], trackByIdentity);
      expect(pc.getCollection()).toEqual(['c', 'a', 'b']);

      // what happens here is that
    });
  });
});
