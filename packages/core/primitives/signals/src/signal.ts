/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {defaultEquals, ValueEqualityFn} from './equality';
import {throwInvalidWriteToSignalError} from './errors';
import {producerAccessed, producerNotifyConsumers, producerUpdatesAllowed, REACTIVE_NODE, ReactiveNode, SIGNAL} from './graph';

/**
 * If set, called after `WritableSignal`s are updated.
 *
 * This hook can be used to achieve various effects, such as running effects synchronously as part
 * of setting a signal.
 */
let postSignalSetFn: (() => void)|null = null;

export interface SignalNode<T> extends ReactiveNode {
  value: T;
  equal: ValueEqualityFn<T>;
  readonly[SIGNAL]: SignalNode<T>;
}

export type SignalBaseGetter<T> = (() => T)&{readonly[SIGNAL]: unknown};

// Note: Closure *requires* this to be an `interface` and not a type, which is why the
// `SignalBaseGetter` type exists to provide the correct shape.
export interface SignalGetter<T> extends SignalBaseGetter<T> {
  readonly[SIGNAL]: SignalNode<T>;
}

/**
 * Create a `Signal` that can be set or updated directly.
 */
export function createSignal<T>(initialValue: T): SignalGetter<T> {
  const node: SignalNode<T> = Object.create(SIGNAL_NODE);
  node.value = initialValue;
  const getter = (() => {
                   producerAccessed(node);
                   return node.value;
                 }) as SignalGetter<T>;
  (getter as any)[SIGNAL] = node;
  return getter;
}

export function setPostSignalSetFn(fn: (() => void)|null): (() => void)|null {
  const prev = postSignalSetFn;
  postSignalSetFn = fn;
  return prev;
}

export function signalGetFn<T>(this: SignalNode<T>): T {
  producerAccessed(this);
  return this.value;
}

export function signalSetFn<T>(node: SignalNode<T>, newValue: T) {
  if (!producerUpdatesAllowed()) {
    throwInvalidWriteToSignalError();
  }

  const value = node.value;
  // assuming that signal value equality implementations should always return true for values that
  // are the same according to Object.is
  if (!Object.is(value, newValue) && !node.equal(value, newValue)) {
    node.value = newValue;
    signalValueChanged(node);
  }
}

export function signalUpdateFn<T>(node: SignalNode<T>, updater: (value: T) => T): void {
  if (!producerUpdatesAllowed()) {
    throwInvalidWriteToSignalError();
  }

  signalSetFn(node, updater(node.value));
}

export function signalMutateFn<T>(node: SignalNode<T>, mutator: (value: T) => void): void {
  if (!producerUpdatesAllowed()) {
    throwInvalidWriteToSignalError();
  }
  // Mutate bypasses equality checks as it's by definition changing the value.
  mutator(node.value);
  signalValueChanged(node);
}

// Note: Using an IIFE here to ensure that the spread assignment is not considered
// a side-effect, ending up preserving `COMPUTED_NODE` and `REACTIVE_NODE`.
// TODO: remove when https://github.com/evanw/esbuild/issues/3392 is resolved.
const SIGNAL_NODE: object = /* @__PURE__ */ (() => {
  return {
    ...REACTIVE_NODE,
    equal: defaultEquals,
    value: undefined,
  };
})();

function signalValueChanged<T>(node: SignalNode<T>): void {
  node.version++;
  producerNotifyConsumers(node);
  postSignalSetFn?.();
}
