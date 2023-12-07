/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ProviderToken} from '../di';
import {ElementRef} from '../linker';
import {Signal} from '../render3/reactivity/api';

// THINK: discuss with Paul the location of those special functions (packages/core/src/authoring/)
// and schema for naming files under this folder

// https://source.corp.google.com/search?q=(ViewChild%7CContentChild)(ren)%3F.*forwardRef&sq=package:piper%20file:%2F%2Fdepot%2Fgoogle3%20-file:google3%2Fexperimental

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
  return null!;
}

function viewChildRequiredFn<V>(
    selector: ProviderToken<V>|string, opts?: {static?: boolean}): Signal<V>;
function viewChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string, opts: {read: ProviderToken<V>, static?: boolean}): Signal<V>;
function viewChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {read?: ProviderToken<V>, static?: boolean}): Signal<V> {
  return null!;
}

viewChildFn.required = viewChildRequiredFn;
export const viewChild: typeof viewChildFn&{required: typeof viewChildRequiredFn} = viewChildFn;

// THINK: leaning towards dropping the option for emitting distinct values (having it always as
// true) BUT what about the migration?
function viewChildren<V>(selector: ProviderToken<V>|string): Signal<V[]>;
function viewChildren<V, T>(
    selector: ProviderToken<T>|string, opts: {read: ProviderToken<V>}): Signal<V[]>;
function viewChildren<V, T>(
    selector: ProviderToken<T>|string, opts?: {read?: ProviderToken<V>}): Signal<V[]> {
  return null!;
}

function contentChildFn<V>(
    selector: ProviderToken<V>|string,
    opts?: {descendants?: boolean, static?: boolean}): Signal<V|undefined>;
function contentChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>, static?: boolean}): Signal<V|undefined>;
function contentChildFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>, static?: boolean}):
    Signal<V|undefined> {
  return null!;
}

function contentChildRequiredFn<V>(
    selector: ProviderToken<V>|string, opts?: {descendants?: boolean, static?: boolean}): Signal<V>;
function contentChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>, static?: boolean}): Signal<V>;
function contentChildRequiredFn<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>, static?: boolean}): Signal<V> {
  return null!;
}

contentChildFn.required = contentChildRequiredFn;
export const contentChild: typeof contentChildFn&{required: typeof contentChildRequiredFn} =
    contentChildFn;

function contentChildren<V>(
    selector: ProviderToken<V>|string, opts?: {descendants?: boolean}): Signal<V[]>;
function contentChildren<V, T>(
    selector: ProviderToken<T>|string,
    opts: {descendants?: boolean, read: ProviderToken<V>}): Signal<V[]>;
function contentChildren<V, T>(
    selector: ProviderToken<T>|string,
    opts?: {descendants?: boolean, read?: ProviderToken<V>}): Signal<V[]> {
  return null!;
}

class QueryCmp {
  c = 'component';
}
class ReadToken {
  t = 'token';
}

class MyCmp {
  vChildType = viewChild(QueryCmp);
  vChildTypeRead = viewChild(QueryCmp, {read: ReadToken});
  vChildTypeReq = viewChild.required(QueryCmp);
  vChildTypeReqRead = viewChild.required(QueryCmp, {read: ReadToken});

  // ElementRef / TemplateRef needs to be specified explicitly here..
  // we can't assume it is ElementRef since the type depends on the element type on which we've got
  // a local ref
  vChildLocalRef = viewChild<ElementRef>('foo');
  vChildLocalRefRead = viewChild('foo', {read: ReadToken});
  vChildLocalRefReq = viewChild.required<ElementRef>('foo');
  vChildLocalRefReqRead = viewChild.required('foo', {read: ReadToken});

  vChildren = viewChildren(QueryCmp);
  vChildrenRead = viewChildren(QueryCmp, {read: ReadToken});

  cChildType = contentChild(QueryCmp);
  cChildTypeRead = contentChild(QueryCmp, {read: ReadToken});
  cChildTypeReq = contentChild.required(QueryCmp);
  cChildTypeReqRead = contentChild.required(QueryCmp, {read: ReadToken});

  cChildLocalRef = contentChild<ElementRef>('foo');
  cChildLocalRefRead = contentChild('foo', {read: ReadToken});
  cChildLocalRefReq = contentChild.required<ElementRef>('foo');
  cChildLocalRefReqRead = contentChild.required('foo', {read: ReadToken});

  cChildren = contentChildren(QueryCmp, {descendants: true});
  cChildrenRead = contentChildren(QueryCmp, {read: ReadToken});

  constructor() {
    // view child with a DI predicate
    this.vChildType()?.c;
    this.vChildTypeRead()?.t;
    this.vChildTypeReq().c;
    this.vChildTypeReqRead().t;

    // view child with a local ref predicate
    this.vChildLocalRef()?.nativeElement;
    this.vChildLocalRefRead()?.t;
    this.vChildLocalRefReq().nativeElement;
    this.vChildLocalRefReqRead().t;

    // view children variants
    this.vChildren().at(0)?.c;
    this.vChildrenRead().at(0)?.t;

    // content child with a DI predicate
    this.cChildType()?.c;
    this.cChildTypeRead()?.t;
    this.cChildTypeReq().c;
    this.cChildTypeReqRead().t;

    // view child with a local ref predicate
    this.cChildLocalRef()?.nativeElement;
    this.cChildLocalRefRead()?.t;
    this.cChildLocalRefReq().nativeElement;
    this.cChildLocalRefReqRead().t;

    // content children variants
    this.cChildren().at(0)?.c;
    this.cChildrenRead().at(0)?.t;
  }
}
