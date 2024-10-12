/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Injector} from '../di/injector';
import {Signal, ValueEqualityFn} from '../render3/reactivity/api';
import {WritableSignal} from '../render3/reactivity/signal';

export type ResourceStatus = 'idle' | 'error' | 'loading' | 'refreshing' | 'resolved' | 'local';

export interface Resource<T> {
  readonly value: Signal<T | undefined>;
  readonly status: Signal<ResourceStatus>;
  readonly error: Signal<unknown>;
}

export interface WritableResource<T> extends Resource<T> {
  readonly value: WritableSignal<T | undefined>;
}

export type ResourceLoaderParams<R> = {
  request: Exclude<NoInfer<R>, undefined>;
  abortSignal: AbortSignal;
  previous: {
    status: ResourceStatus;
  };
};

export type ResourceLoader<T, R> = (param: ResourceLoaderParams<R>) => Promise<T>;

export interface ResourceOptions<T, R> {
  request?: () => R;
  loader: ResourceLoader<T, R>;
  equal?: ValueEqualityFn<T>;
  injector?: Injector;
}
