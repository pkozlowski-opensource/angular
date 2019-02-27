/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {assertDataInRange, assertDefined, assertEqual, assertGreaterOrEqual, assertGreaterThan, assertLessThan} from '../../util/assert';
import {LContainer, TYPE} from '../interfaces/container';
import {LContext, MONKEY_PATCH_KEY_NAME} from '../interfaces/context';
import {ComponentDef, DirectiveDef} from '../interfaces/definition';
import {TNode, TNodeFlags} from '../interfaces/node';
import {RNode} from '../interfaces/renderer';
import {StylingContext} from '../interfaces/styling';
import {FLAGS, HEADER_OFFSET, HOST, LView, LViewFlags, TData, TVIEW, View, ViewContainer} from '../interfaces/view';



export function viewToLView(view: View): LView {
  ngDevMode && assertDefined(view, 'LView must be defined');
  ngDevMode && assertEqual(isLView(view), true, 'Expecting LView');
  return view as any;
}

export const lViewToView: (view: LView) => View = viewToLView as any;

export function lContainerToViewContainer(view: LContainer): ViewContainer {
  ngDevMode && assertDefined(view, 'LContainer must be defined');
  ngDevMode && assertEqual(isLContainer(view), true, 'Expecting LContainer');
  return view as any;
}
export const viewContainerToLContainer: (view: ViewContainer) => LContainer =
    lContainerToViewContainer as any;

/**
 * For efficiency reasons we often put several different data types (`RNode`, `LView`, `LContainer`,
 * `StylingContext`) in same location in `LView`. This is because we don't want to pre-allocate
 * space for it because the storage is sparse. This file contains utilities for dealing with such
 * data types.
 *
 * How do we know what is stored at a given location in `LView`.
 * - `Array.isArray(value) === false` => `RNode` (The normal storage value)
 * - `Array.isArray(value) === true` => then the `value[0]` represents the wrapped value.
 *   - `typeof value[TYPE] === 'object'` => `LView`
 *      - This happens when we have a component at a given location
 *   - `typeof value[TYPE] === 'number'` => `StylingContext`
 *      - This happens when we have style/class binding at a given location.
 *   - `typeof value[TYPE] === true` => `LContainer`
 *      - This happens when we have `LContainer` binding at a given location.
 *
 *
 * NOTE: it is assumed that `Array.isArray` and `typeof` operations are very efficient.
 */

/**
 * Returns `RNode`.
 * @param value wrapped value of `RNode`, `LView`, `LContainer`, `StylingContext`
 */
export function unwrapRNode(value: RNode | LView | LContainer | StylingContext): RNode {
  while (Array.isArray(value)) {
    value = value[HOST] as any;
  }
  return value as RNode;
}

/**
 * Returns `LView` or `null` if not found.
 * @param value wrapped value of `RNode`, `LView`, `LContainer`, `StylingContext`
 */
export function unwrapLView(value: RNode | LView | LContainer | StylingContext): LView|null {
  while (Array.isArray(value)) {
    // This check is same as `isLView()` but we don't call at as we don't want to call
    // `Array.isArray()` twice and give JITer more work for inlining.
    if (typeof value[TYPE] === 'object') return value as LView;
    value = value[HOST] as any;
  }
  return null;
}

/**
 * Returns `LContainer` or `null` if not found.
 * @param value wrapped value of `RNode`, `LView`, `LContainer`, `StylingContext`
 */
export function unwrapLContainer(value: RNode | LView | LContainer | StylingContext): LContainer|
    null {
  while (Array.isArray(value)) {
    // This check is same as `isLContainer()` but we don't call at as we don't want to call
    // `Array.isArray()` twice and give JITer more work for inlining.
    if (value[TYPE] === true) return value as LContainer;
    value = value[HOST] as any;
  }
  return null;
}

/**
 * Returns `StylingContext` or `null` if not found.
 * @param value wrapped value of `RNode`, `LView`, `LContainer`, `StylingContext`
 */
export function unwrapStylingContext(value: RNode | LView | LContainer | StylingContext):
    StylingContext|null {
  while (Array.isArray(value)) {
    // This check is same as `isStylingContext()` but we don't call at as we don't want to call
    // `Array.isArray()` twice and give JITer more work for inlining.
    if (typeof value[TYPE] === 'number') return value as StylingContext;
    value = value[HOST] as any;
  }
  return null;
}

/**
 * True if `value` is `LView`.
 * @param value wrapped value of `RNode`, `LView`, `LContainer`, `StylingContext`
 */
export function isLView(value: RNode | LView | LContainer | StylingContext | {} | null):
    value is LView {
  return Array.isArray(value) && typeof value[TYPE] === 'object';
}

/**
 * True if `value` is `LContainer`.
 * @param value wrapped value of `RNode`, `LView`, `LContainer`, `StylingContext`
 */
export function isLContainer(value: RNode | LView | LContainer | StylingContext | {} | null):
    value is LContainer {
  return Array.isArray(value) && value[TYPE] === true;
}

/**
 * True if `value` is `StylingContext`.
 * @param value wrapped value of `RNode`, `LView`, `LContainer`, `StylingContext`
 */
export function isStylingContext(value: RNode | LView | LContainer | StylingContext | {} | null):
    value is StylingContext {
  return Array.isArray(value) && typeof value[TYPE] === 'number';
}

/**
 * Retrieves an element value from the provided `viewData`, by unwrapping
 * from any containers, component views, or style contexts.
 */
export function getNativeByIndex(index: number, lView: LView): RNode {
  return unwrapRNode(lView[index + HEADER_OFFSET]);
}

export function getNativeByTNode(tNode: TNode, hostView: LView): RNode {
  return unwrapRNode(hostView[tNode.index]);
}

export function getTNode(index: number, view: LView): TNode {
  ngDevMode && assertGreaterThan(index, -1, 'wrong index for TNode');
  ngDevMode &&
      assertLessThan(index + HEADER_OFFSET, view[TVIEW].data.length, 'wrong index for TNode');
  return view[TVIEW].data[index + HEADER_OFFSET] as TNode;
}

/** Retrieves a value from any `LView` or `TData`. */
export function loadInternal<T>(view: LView | TData, index: number): T {
  ngDevMode && assertDataInRange(view, index + HEADER_OFFSET);
  return view[index + HEADER_OFFSET];
}

export function getComponentViewByIndex(nodeIndex: number, hostView: LView): LView {
  // Could be an LView or an LContainer. If LContainer, unwrap to find LView.
  const slotValue = hostView[nodeIndex];
  const lView = isLView(slotValue) ? slotValue : slotValue[HOST];
  return lView;
}

export function isContentQueryHost(tNode: TNode): boolean {
  return (tNode.flags & TNodeFlags.hasContentQuery) !== 0;
}

export function isComponent(tNode: TNode): boolean {
  return (tNode.flags & TNodeFlags.isComponent) === TNodeFlags.isComponent;
}

export function isComponentDef<T>(def: DirectiveDef<T>): def is ComponentDef<T> {
  return (def as ComponentDef<T>).template !== null;
}

export function isRootView(target: LView): boolean {
  return (target[FLAGS] & LViewFlags.IsRoot) !== 0;
}

/**
 * Returns the monkey-patch value data present on the target (which could be
 * a component, directive or a DOM node).
 */
export function readPatchedData(target: any): LView|LContext|null {
  ngDevMode && assertDefined(target, 'Target expected');
  return target[MONKEY_PATCH_KEY_NAME];
}

export function readPatchedLView(target: any): LView|null {
  const value = readPatchedData(target);
  if (value) {
    return Array.isArray(value) ? value : (value as LContext).lView;
  }
  return null;
}

/**
 * TODO
 * @param lView
 */
export function getLastRootElementFromView(lView: LView): RNode {
  const tView = lView[TVIEW];
  let child = tView.firstChild;
  ngDevMode && assertDefined(child, 'tView must have at least one root element');
  let lastChild: TNode;
  while (child) {
    lastChild = child;
    child = child.next;
  }
  return unwrapRNode(lView[lastChild !.index]);
}

export function getRNode(lView: LView, index: number): RNode {
  ngDevMode && assertDefined(lView, 'LView must be defined');
  ngDevMode && assertEqual(isLView(lView), true, 'Expecting LView');
  ngDevMode && assertGreaterOrEqual(index, HEADER_OFFSET, 'index must be past the HEADER_OFFSET');

  return unwrapRNode(lView[index]);
}
