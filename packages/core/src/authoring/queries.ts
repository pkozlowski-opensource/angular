/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ProviderToken} from '../di';
import {createQuerySignalFn} from '../render3/query';
import {Signal} from '../render3/reactivity/api';

// THINK: discuss with Paul the location of those special functions (packages/core/src/authoring/)
// and schema for naming files under this folder

function viewChildFn<V>(selector: ProviderToken<V>|string): Signal<V|undefined>;
function viewChildFn<V, T>(
    selector: ProviderToken<T>|string, opts: {read: ProviderToken<V>}): Signal<V|undefined>;
function viewChildFn<V, T>(
    selector: ProviderToken<T>|string, opts?: {read?: ProviderToken<V>}): Signal<V|undefined> {
  return createQuerySignalFn(true, false) as Signal<V|undefined>;
}

function viewChildRequiredFn<V>(selector: ProviderToken<V>|string): Signal<V>;
function viewChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string, opts: {read: ProviderToken<V>}): Signal<V>;
function viewChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string, opts?: {read?: ProviderToken<V>}): Signal<V> {
  return createQuerySignalFn(true, true) as Signal<V>;
}

viewChildFn.required = viewChildRequiredFn;
export const viewChild: typeof viewChildFn&{required: typeof viewChildRequiredFn} = viewChildFn;

export function viewChildren<V>(selector: ProviderToken<V>|string): Signal<ReadonlyArray<V>>;
export function viewChildren<V, T>(
    selector: ProviderToken<T>|string, opts: {read: ProviderToken<V>}): Signal<ReadonlyArray<V>>;
export function viewChildren<V, T>(
    selector: ProviderToken<T>|string, opts?: {read?: ProviderToken<V>}): Signal<ReadonlyArray<V>> {
  return createQuerySignalFn(false, false);
}

export function contentChildFn<V>(
    selector: ProviderToken<V>|string, opts?: {descendants?: boolean}): Signal<V|undefined>;
export function contentChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>}): Signal<V|undefined>;
export function contentChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>}): Signal<V|undefined> {
  return createQuerySignalFn(true, false);
}

function contentChildRequiredFn<V>(
    selector: ProviderToken<V>|string, opts?: {descendants?: boolean}): Signal<V>;
function contentChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>}): Signal<V>;
function contentChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>}): Signal<V> {
  return createQuerySignalFn(true, true);
}

contentChildFn.required = contentChildRequiredFn;
export const contentChild: typeof contentChildFn&{required: typeof contentChildRequiredFn} =
    contentChildFn;

export function contentChildren<V>(
    selector: ProviderToken<V>|string, opts?: {descendants?: boolean}): Signal<ReadonlyArray<V>>;
export function contentChildren<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>}): Signal<ReadonlyArray<V>>;
export function contentChildren<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>}): Signal<ReadonlyArray<V>> {
  return createQuerySignalFn(false, false);
}
