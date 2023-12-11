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


// THINK: do we need to support the Function signature in the predicate? Is this to support forward
// refs?
// THINK: do we have a better type signature for the forwardRef functions?
// THINK: do we still need the "static" option? The thinking is YES since it influences the
// assignment timing and might be needed for migration
function viewChildFn<V>(
    selector: ProviderToken<V>|string, opts?: {static?: boolean}): Signal<V|undefined>;
function viewChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts: {read: ProviderToken<V>, static?: boolean}): Signal<V|undefined>;
function viewChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {read?: ProviderToken<V>, static?: boolean}): Signal<V|undefined> {
  return createQuerySignalFn(true, false) as Signal<V|undefined>;
}

function viewChildRequiredFn<V>(
    selector: ProviderToken<V>|string, opts?: {static?: boolean}): Signal<V>;
function viewChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string, opts: {read: ProviderToken<V>, static?: boolean}): Signal<V>;
function viewChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {read?: ProviderToken<V>, static?: boolean}): Signal<V> {
  return createQuerySignalFn(true, true) as Signal<V>;
}

viewChildFn.required = viewChildRequiredFn;
export const viewChild: typeof viewChildFn&{required: typeof viewChildRequiredFn} = viewChildFn;

// THINK: leaning towards dropping the option for emitting distinct values (having it always as
// true) BUT what about the migration?
export function viewChildren<V>(selector: ProviderToken<V>|string): Signal<V[]>;
export function viewChildren<V, T>(
    selector: ProviderToken<T>|string, opts: {read: ProviderToken<V>}): Signal<V[]>;
export function viewChildren<V, T>(
    selector: ProviderToken<T>|string, opts?: {read?: ProviderToken<V>}): Signal<V[]> {
  return createQuerySignalFn(false, false) as Signal<V[]>;
}

export function contentChildFn<V>(
    selector: ProviderToken<V>|string,
    opts?: {descendants?: boolean, static?: boolean}): Signal<V|undefined>;
export function contentChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>, static?: boolean}): Signal<V|undefined>;
export function contentChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>, static?: boolean}):
    Signal<V|undefined> {
  return createQuerySignalFn(true, false) as Signal<V|undefined>;
}

function contentChildRequiredFn<V>(
    selector: ProviderToken<V>|string, opts?: {descendants?: boolean, static?: boolean}): Signal<V>;
function contentChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>, static?: boolean}): Signal<V>;
function contentChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>, static?: boolean}): Signal<V> {
  return createQuerySignalFn(true, true) as Signal<V>;
}

contentChildFn.required = contentChildRequiredFn;
export const contentChild: typeof contentChildFn&{required: typeof contentChildRequiredFn} =
    contentChildFn;

export function contentChildren<V>(
    selector: ProviderToken<V>|string, opts?: {descendants?: boolean}): Signal<V[]>;
export function contentChildren<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>}): Signal<V[]>;
export function contentChildren<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>}): Signal<V[]> {
  return createQuerySignalFn(false, false) as Signal<V[]>;
}
