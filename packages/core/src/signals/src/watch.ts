/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {consumerAfterComputation, consumerBeforeComputation, consumerDestroy, consumerMarkDirty, consumerPollProducersForChange, isInNotificationPhase, REACTIVE_NODE, ReactiveNode} from './graph';

/**
 * A cleanup function that can be optionally registered from the watch logic. If registered, the
 * cleanup logic runs before the next watch execution.
 */
export type WatchCleanupFn = () => void;

/**
 * A callback passed to the watch function that makes it possible to register cleanup logic.
 */
export type WatchCleanupRegisterFn = (cleanupFn: WatchCleanupFn) => void;

export interface Watch {
  notify(): void;

  /**
   * Execute the reactive expression in the context of this `Watch` consumer.
   *
   * Should be called by the user scheduling algorithm when the provided
   * `schedule` hook is called by `Watch`.
   */
  run(): void;

  cleanup(): void;

  /**
   * Destroy the watcher:
   * - disconnect it from the reactive graph;
   * - mark it as destroyed so subsequent run and notify operations are noop.
   */
  destroy(): void;
}

export function watch(
    fn: (onCleanup: WatchCleanupRegisterFn) => void, schedule: (watch: Watch) => void,
    allowSignalWrites: boolean): Watch {
  const node: WatchNode = Object.create(WATCH_NODE);
  if (allowSignalWrites) {
    node.consumerAllowSignalWrites = true;
  }

  node.fn = fn;
  node.schedule = schedule;

  const registerOnCleanup = (cleanupFn: WatchCleanupFn) => {
    node.cleanupFn = cleanupFn;
  };

  function isWatchNodeDestroyed(node: WatchNode) {
    return node.fn === null && node.schedule === null;
  }

  function destroyWatchNode(node: WatchNode) {
    if (!isWatchNodeDestroyed(node)) {
      consumerDestroy(node);  // disconnect watcher from the reactive graph
      node.cleanupFn();

      // nullify references to the integration functions to mark node as destroyed
      node.fn = null;
      node.schedule = null;
      node.cleanupFn = NOOP_CLEANUP_FN;
    }
  }

  const run = () => {
    if (node.fn === null) {
      // trying to run a destroyed watch is noop
      return;
    }

    if (isInNotificationPhase()) {
      throw new Error(`Schedulers cannot synchronously execute watches while scheduling.`);
    }

    node.dirty = false;
    if (node.hasRun && !consumerPollProducersForChange(node)) {
      return;
    }
    node.hasRun = true;

    const prevConsumer = consumerBeforeComputation(node);
    try {
      node.cleanupFn();
      node.cleanupFn = NOOP_CLEANUP_FN;
      node.fn(registerOnCleanup);
    } finally {
      consumerAfterComputation(node, prevConsumer);
    }
  };

  node.ref = {
    notify: () => consumerMarkDirty(node),
    run,
    cleanup: () => node.cleanupFn(),
    destroy: () => destroyWatchNode(node),
  };

  return node.ref;
}

const NOOP_CLEANUP_FN: WatchCleanupFn = () => {};

interface WatchNode extends ReactiveNode {
  hasRun: boolean;
  fn: ((onCleanup: WatchCleanupRegisterFn) => void)|null;
  schedule: ((watch: Watch) => void)|null;
  cleanupFn: WatchCleanupFn;
  ref: Watch;
}

const WATCH_NODE: Partial<WatchNode> = {
  ...REACTIVE_NODE,
  consumerIsAlwaysLive: true,
  consumerAllowSignalWrites: false,
  consumerMarkedDirty: (node: WatchNode) => {
    if (node.schedule !== null) {
      node.schedule(node.ref);
    }
  },
  hasRun: false,
  cleanupFn: NOOP_CLEANUP_FN,
};
