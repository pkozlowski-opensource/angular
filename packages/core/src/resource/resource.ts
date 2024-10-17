/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {untracked} from '../render3/reactivity/untracked';
import {computed} from '../render3/reactivity/computed';
import {signal, WritableSignal} from '../render3/reactivity/signal';
import {Signal} from '../render3/reactivity/api';
import {effect} from '../render3/reactivity/effect';
import {ResourceOptions, ResourceStatus, WritableResource, ResourceLoader} from './api';
import {ValueEqualityFn, SIGNAL, SignalNode} from '@angular/core/primitives/signals';
import {Injector} from '../di/injector';
import {assertInInjectionContext} from '../di/contextual';

export function resource<T>(options: ResourceOptions<T, unknown>): WritableResource<T>;
export function resource<T, R>(options: ResourceOptions<T, R>): WritableResource<T>;
export function resource<T, R>(options: ResourceOptions<T, R>): WritableResource<T> {
  options?.injector || assertInInjectionContext(resource);
  const request = (options.request ?? (() => null)) as () => R;
  return new WritableResourceImpl<T, R>(request, options.loader, options.equal, options.injector);
}

export abstract class BaseWritableResource<T> implements WritableResource<T> {
  readonly value: WritableSignal<T | undefined>;
  readonly status = signal<ResourceStatus>('idle');
  readonly error = signal<unknown>(undefined);

  protected readonly rawSetValue: (value: T | undefined) => void;

  constructor(equal: ValueEqualityFn<T> | undefined) {
    this.value = signal<T | undefined>(undefined, {
      equal: equal ? wrapEqualityFn(equal) : undefined,
    });
    this.rawSetValue = this.value.set;
    this.value.set = (value: T | undefined) => this.set(value);
    this.value.update = (fn: (value: T | undefined) => T | undefined) =>
      this.set(fn(untracked(this.value)));
  }

  set(value: T | undefined) {
    // Set the value signal and check whether its `version` changes. This will tell us
    // if the value signal actually updated or not.
    const prevVersion = (this.value[SIGNAL] as SignalNode<T>).version;
    this.rawSetValue(value);
    if ((this.value[SIGNAL] as SignalNode<T>).version === prevVersion) {
      // The value must've been equal to the previous, so no need to change states.
      return;
    }

    // We're departing from whatever state the resource was in previously, and entering
    // Local state.
    this.maybeCancelLoad();
    this.status.set('local');
    this.error.set(undefined);
  }

  protected setValueState(status: ResourceStatus, value: T | undefined = undefined): void {
    this.status.set(status);
    this.rawSetValue(value);
    this.error.set(undefined);
  }

  protected setErrorState(err: unknown): void {
    this.status.set('error');
    this.value.set(undefined);
    this.error.set(err);
  }

  protected abstract maybeCancelLoad(): void;
  public abstract refresh(): void;
}

export class WritableResourceImpl<T, R> extends BaseWritableResource<T> {
  private pendingController: AbortController | undefined;
  private readonly request: Signal<{request: R; refresh: WritableSignal<number>}>;

  constructor(
    requestFn: () => R,
    private readonly loaderFn: ResourceLoader<T, R>,
    equal: ValueEqualityFn<T> | undefined,
    injector: Injector | undefined,
  ) {
    super(equal);
    this.request = computed(() => ({request: requestFn(), refresh: signal(0)}));
    effect(this.loadEffect.bind(this), {injector});
  }

  override refresh(): void {
    // No point in restarting an in-progress load.
    const status = untracked(this.status);
    if (status === 'loading' || status === 'refreshing') {
      return;
    }
    untracked(this.request).refresh.update((v) => v + 1);
  }

  private async loadEffect(): Promise<void> {
    const previousStatus = untracked(this.status);
    this.maybeCancelLoad();

    const request = this.request();
    if (request.request === undefined) {
      // An undefined request means there's nothing to load.
      this.setValueState('idle');
      return;
    }

    // Subscribing here allows us to refresh the load later by updating the refresh signal. At the
    // same time, we update the status according to whether we're refreshing or loading.
    this.status.set(request.refresh() === 0 ? 'loading' : 'refreshing');

    const {signal} = (this.pendingController = new AbortController());

    try {
      const result = await untracked(() =>
        this.loaderFn({
          abortSignal: signal,
          request: request.request as Exclude<R, undefined>,
          previous: {
            status: previousStatus,
          },
        }),
      );
      if (signal.aborted) {
        // This load operation was cancelled.
        return;
      }
      this.setValueState('resolved', result);
    } catch (err) {
      if (signal.aborted) {
        // This load operation was cancelled.
        return;
      }
      this.setErrorState(err);
    }
  }

  protected override maybeCancelLoad(): void {
    this.pendingController?.abort();
    this.pendingController = undefined;
  }
}

function wrapEqualityFn<T>(equal: ValueEqualityFn<T>): ValueEqualityFn<T | undefined> {
  return (a, b) => (a === undefined || b === undefined ? a === b : equal(a, b));
}
