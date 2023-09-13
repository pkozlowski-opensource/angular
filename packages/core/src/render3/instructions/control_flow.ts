/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {DefaultIterableDiffer, TrackByFunction} from '../../change_detection';
import {assertDefined} from '../../util/assert';
import {assertLContainer, assertLView, assertTNode} from '../assert';
import {bindingUpdated} from '../bindings';
import {CONTAINER_HEADER_OFFSET, LContainer} from '../interfaces/container';
import {ComponentTemplate} from '../interfaces/definition';
import {TNode} from '../interfaces/node';
import {CONTEXT, DECLARATION_COMPONENT_VIEW, HEADER_OFFSET, LView, TVIEW, TView} from '../interfaces/view';
import {destroyLView, detachView} from '../node_manipulation';
import {getLView, nextBindingIndex} from '../state';
import {getTNode} from '../util/view_utils';
import {addLViewToLContainer, createAndRenderEmbeddedLView, getLViewFromLContainer, removeLViewFromLContainer} from '../view_manipulation';

import {ɵɵtemplate} from './template';

/**
 * The conditional instruction represents the basic building block on the runtime side to support
 * built-in "if" and "switch". On the high level this instruction is responsible for adding and
 * removing views selected by a conditional expression.
 *
 * @param containerIndex index of a container in a host view (indexed from HEADER_OFFSET) where
 *     conditional views should be inserted.
 * @param matchingTemplateIndex index of a template TNode representing a conditional view to be
 *     inserted; -1 represents a special case when there is no view to insert.
 * @codeGenApi
 */
export function ɵɵconditional<T>(containerIndex: number, matchingTemplateIndex: number, value?: T) {
  const hostLView = getLView();
  const bindingIndex = nextBindingIndex();
  const lContainer = getLContainer(hostLView, HEADER_OFFSET + containerIndex);
  const viewInContainerIdx = 0;

  if (bindingUpdated(hostLView, bindingIndex, matchingTemplateIndex)) {
    // The index of the view to show changed - remove the previously displayed one
    // (it is a noop if there are no active views in a container).
    removeLViewFromLContainer(lContainer, viewInContainerIdx);

    // Index -1 is a special case where none of the conditions evaluates to
    // a truthy value and as the consequence we've got no view to show.
    if (matchingTemplateIndex !== -1) {
      const templateTNode = getExistingTNode(hostLView[TVIEW], matchingTemplateIndex);
      const embeddedLView = createAndRenderEmbeddedLView(hostLView, templateTNode, value);

      addLViewToLContainer(lContainer, embeddedLView, viewInContainerIdx);
    }
  } else {
    // We might keep displaying the same template but the actual value of the expression could have
    // changed - re-bind in context.
    const lView = getLViewFromLContainer<T|undefined>(lContainer, viewInContainerIdx);
    if (lView !== undefined) {
      lView[CONTEXT] = value;
    }
  }
}

export class RepeaterContext<T> {
  constructor(private lContainer: LContainer, public $implicit: T, public $index: number) {}

  get $count(): number {
    return this.lContainer.length - CONTAINER_HEADER_OFFSET;
  }
}

/**
 * A built-in trackBy function used for situations where users specified collection index as a
 * tracking expression. Having this function body in the runtime avoids unnecessary code generation.
 *
 * @param index
 * @returns
 */
export function ɵɵrepeaterTrackByIndex(index: number) {
  return index;
}

/**
 * A built-in trackBy function used for situations where users specified collection item reference
 * as a tracking expression. Having this function body in the runtime avoids unnecessary code
 * generation.
 *
 * @param index
 * @returns
 */
export function ɵɵrepeaterTrackByIdentity<T>(_: number, value: T) {
  return value;
}

class RepeaterMetadata {
  constructor(
      public hasEmptyBlock: boolean, public differ: DefaultIterableDiffer<unknown>,
      public trackByFn: any) {}
}

/**
 * The repeaterCreate instruction runs in the creation part of the template pass and initializes
 * internal data structures required by the update pass of the built-in repeater logic. Repeater
 * metadata are allocated in the data part of LView with the following layout:
 * - LView[HEADER_OFFSET + index] - metadata
 * - LView[HEADER_OFFSET + index + 1] - reference to a template function rendering an item
 * - LView[HEADER_OFFSET + index + 2] - optional reference to a template function rendering an empty
 * block
 *
 * @param index Index at which to store the metadata of the repeater.
 * @param templateFn Reference to the template of the main repeater block.
 * @param decls The number of nodes, local refs, and pipes for the main block.
 * @param vars The number of bindings for the main block.
 * @param trackByFn Reference to the tracking function.
 * @param trackByUsesComponentInstance Whether the tracking function has any references to the
 *  component instance. If it doesn't, we can avoid rebinding it.
 * @param emptyTemplateFn Reference to the template function of the empty block.
 * @param emptyDecls The number of nodes, local refs, and pipes for the empty block.
 * @param emptyVars The number of bindings for the empty block.
 *
 * @codeGenApi
 */
export function ɵɵrepeaterCreate(
    index: number, templateFn: ComponentTemplate<unknown>, decls: number, vars: number,
    trackByFn: TrackByFunction<unknown>, trackByUsesComponentInstance?: boolean,
    emptyTemplateFn?: ComponentTemplate<unknown>, emptyDecls?: number, emptyVars?: number): void {
  const hasEmptyBlock = emptyTemplateFn !== undefined;
  const hostLView = getLView();
  const boundTrackBy = trackByUsesComponentInstance ?
      // We only want to bind when necessary, because it produces a
      // new function. For pure functions it's not necessary.
      trackByFn.bind(hostLView[DECLARATION_COMPONENT_VIEW][CONTEXT]) :
      trackByFn;
  // TODO: init DefaultIterableDiffer lazily
  const metadata =
      new RepeaterMetadata(hasEmptyBlock, new DefaultIterableDiffer(boundTrackBy), boundTrackBy);
  hostLView[HEADER_OFFSET + index] = metadata;

  ɵɵtemplate(index + 1, templateFn, decls, vars);

  if (hasEmptyBlock) {
    ngDevMode &&
        assertDefined(emptyDecls, 'Missing number of declarations for the empty repeater block.');
    ngDevMode &&
        assertDefined(emptyVars, 'Missing number of bindings for the empty repeater block.');

    ɵɵtemplate(index + 2, emptyTemplateFn, emptyDecls!, emptyVars!);
  }
}

function reconcile(
    itemTemplateTNode: TNode, hostLView: LView, lContainer: LContainer,
    collection: Readonly<ArrayLike<unknown>>, trackByFn: any, oldStartIdx: number,
    oldEndIdx: number, newStartIdx: number, newEndIdx: number) {
  let detachedViews: Map<unknown, LView>|undefined = undefined;

  // THINK: seems like the trackBy function would be invoked on the same item multiple times
  while (oldStartIdx < oldEndIdx && newStartIdx < newEndIdx) {
    // compare from the beginning
    const oldViewStart = getExistingLViewFromLContainer<RepeaterContext<unknown>>(
        lContainer, oldStartIdx - CONTAINER_HEADER_OFFSET);
    const newItemStart = collection[newStartIdx];
    const oldKeyStart = trackByFn(oldViewStart[CONTEXT].$index, oldViewStart[CONTEXT].$implicit);
    const newKeyStart = trackByFn(newStartIdx, newItemStart);
    if (Object.is(oldKeyStart, newKeyStart)) {
      oldStartIdx++;
      newStartIdx++;
      // TODO: similar logic for other places where I skip through a view => add tests (!!!)
      oldViewStart[CONTEXT].$implicit = newItemStart;
      continue;
    }

    // compare from the end
    // THINK: off-by-1 errors and CONTAINER_HEADER_OFFSET are really easy to get wrong -
    // alternatives? Maybe a wrapper
    const oldViewEnd = getExistingLViewFromLContainer<RepeaterContext<unknown>>(
        lContainer, oldEndIdx - CONTAINER_HEADER_OFFSET - 1);
    const newItemEnd = collection[newEndIdx - 1];
    const oldKeyEnd = trackByFn(oldViewEnd[CONTEXT].$index, oldViewEnd[CONTEXT].$implicit);
    const newKeyEnd = trackByFn(newEndIdx, newItemEnd);
    if (Object.is(oldKeyEnd, newKeyEnd)) {
      newEndIdx--;
      oldEndIdx--;
      continue;
    }

    // swap on both ends
    // THINK: do I need to compare both ways? Write a test that exposes a pb
    if (Object.is(newKeyStart, oldKeyEnd) && Object.is(newKeyEnd, oldKeyStart)) {
      swapViews(lContainer, newStartIdx, oldEndIdx - CONTAINER_HEADER_OFFSET - 1);
      newStartIdx++;
      newEndIdx--;
      oldStartIdx++;
      oldEndIdx--;
      continue;
    }

    // fallback to the slow path: detach the old node hoping that we will find a matching sequence
    // later observation: at this point we know that matching from the end is not helping us (?) =>
    // probably not true since we can bump into a swap?
    if (detachedViews === undefined) {
      detachedViews = new Map();
    }
    const lView = detachExistingView<RepeaterContext<unknown>>(
        lContainer, oldEndIdx - CONTAINER_HEADER_OFFSET - 1);
    // TODO: I should not re-calculate key here but rather store it in the repeater context
    detachedViews.set(
        trackByFn(oldStartIdx - CONTAINER_HEADER_OFFSET, lView[CONTEXT].$implicit), lView);

    oldEndIdx--;

    // check if I'm inserting a previously detached view
    if (detachedViews.has(newKeyStart)) {
      addLViewToLContainer(
          lContainer, detachedViews.get(newKeyStart)!, oldStartIdx - CONTAINER_HEADER_OFFSET);
      detachedViews.delete(newKeyStart);
      oldStartIdx++
      oldEndIdx++;
      newStartIdx++;
    }
  }

  // more items in the collection => insert
  while (newStartIdx < newEndIdx) {
    const newViewIdx = adjustToLastLContainerIndex(lContainer, newStartIdx);
    const newItemKey = trackByFn(newViewIdx, collection[newStartIdx]);
    if (detachedViews !== undefined && detachedViews.has(newItemKey)) {
      addLViewToLContainer(lContainer, detachedViews.get(newItemKey)!, newViewIdx);
      detachedViews.delete(newItemKey);
    } else {
      // THINK: this is the part that needs abstracting
      const embeddedLView = createAndRenderEmbeddedLView(
          hostLView, itemTemplateTNode,
          new RepeaterContext(lContainer, collection[newStartIdx], newViewIdx));
      addLViewToLContainer(lContainer, embeddedLView, newViewIdx);
    }

    newStartIdx++;
  }

  // more items in a container => delete starting from the end
  while (oldStartIdx < oldEndIdx) {
    const lView = detachExistingView(lContainer, oldEndIdx - CONTAINER_HEADER_OFFSET - 1);
    destroyLView(lView[TVIEW], lView);
    oldEndIdx--;
  }

  // drop any views that were perviously detached but were not part of the new collection
  if (detachedViews !== undefined) {
    for (const lView of detachedViews.values()) {
      destroyLView(lView[TVIEW], lView);
    }
  }


  // TESTS to write:
  // - duplicated keys => what should happen here? Careful - throwing in the dev mode is not
  // sufficient as production data might change the equation
  // - not an array => what should happen here? fallback to a different algo? Or just throw?
}

const EMPTY_ARRAY: Array<unknown> = [];

/**
 * The repeater instruction does update-time diffing of a provided collection (against the
 * collection seen previously) and maps changes in the collection to views structure (by adding,
 * removing or moving views as needed).
 * @param metadataSlotIdx - index in data where we can find an instance of RepeaterMetadata with
 *     additional information (ex. differ) needed to process collection diffing and view
 *     manipulation
 * @param collection - the collection instance to be checked for changes
 * @codeGenApi
 */
export function ɵɵrepeater(
    metadataSlotIdx: number, collection: Iterable<unknown>|undefined|null): void {
  const hostLView = getLView();
  const hostTView = hostLView[TVIEW];
  // TODO: metadata depends on the differ
  const metadata = hostLView[HEADER_OFFSET + metadataSlotIdx] as RepeaterMetadata;
  const containerIndex = metadataSlotIdx + 1;
  const lContainer = getLContainer(hostLView, HEADER_OFFSET + containerIndex);

  // THINK: abstract this part so the diffing / reconciler returns this info ?
  let hasItemsInCollection = false;

  if (Array.isArray(collection) || collection == null) {
    const itemTemplateTNode = getExistingTNode(hostTView, containerIndex);
    const collectionLen = collection != null ? collection.length : 0;
    hasItemsInCollection = collectionLen > 0;
    reconcile(
        itemTemplateTNode, hostLView, lContainer, collection ?? EMPTY_ARRAY, metadata.trackByFn,
        CONTAINER_HEADER_OFFSET, lContainer.length, 0, collectionLen);
  }

  // PERF: blasting through the whole collection isn't great - can I adjust those in-place?
  for (let i = 0; i < lContainer.length - CONTAINER_HEADER_OFFSET; i++) {
    const lView = getExistingLViewFromLContainer<RepeaterContext<unknown>>(lContainer, i);
    lView[CONTEXT].$index = i;
  }


  /*   const differ = metadata.differ;
    const changes = differ.diff(collection);

    // handle repeater changes
    if (changes !== null) {
      const containerIndex = metadataSlotIdx + 1;
      const itemTemplateTNode = getExistingTNode(hostTView, containerIndex);
      const lContainer = getLContainer(hostLView, HEADER_OFFSET + containerIndex);
      let needsIndexUpdate = false;
      changes.forEachOperation(
          (item: IterableChangeRecord<unknown>, adjustedPreviousIndex: number|null,
           currentIndex: number|null) => {
            if (item.previousIndex === null) {
              // add
              const newViewIdx = adjustToLastLContainerIndex(lContainer, currentIndex);
              const embeddedLView = createAndRenderEmbeddedLView(
                  hostLView, itemTemplateTNode,
                  new RepeaterContext(lContainer, item.item, newViewIdx));
              addLViewToLContainer(lContainer, embeddedLView, newViewIdx);
              needsIndexUpdate = true;
            } else if (currentIndex === null) {
              // remove
              adjustedPreviousIndex = adjustToLastLContainerIndex(lContainer,
    adjustedPreviousIndex); removeLViewFromLContainer(lContainer, adjustedPreviousIndex);
              needsIndexUpdate = true;
            } else if (adjustedPreviousIndex !== null) {
              // move
              const existingLView =
                  detachExistingView<RepeaterContext<unknown>>(lContainer, adjustedPreviousIndex);
              addLViewToLContainer(lContainer, existingLView, currentIndex);
              needsIndexUpdate = true;
            }
          });

      // A trackBy function might return the same value even if the underlying item changed -
    re-bind
      // it in the context.
      changes.forEachIdentityChange((record: IterableChangeRecord<unknown>) => {
        const viewIdx = adjustToLastLContainerIndex(lContainer, record.currentIndex);
        const lView = getExistingLViewFromLContainer<RepeaterContext<unknown>>(lContainer,
    viewIdx); lView[CONTEXT].$implicit = record.item;
      });

      // moves in the container might caused context's index to get out of order, re-adjust
      if (needsIndexUpdate) {
        for (let i = 0; i < lContainer.length - CONTAINER_HEADER_OFFSET; i++) {
          const lView = getExistingLViewFromLContainer<RepeaterContext<unknown>>(lContainer, i);
          lView[CONTEXT].$index = i;
        }
      }
    }
   */


  // handle empty blocks if needed
  if (metadata.hasEmptyBlock) {
    const bindingIndex = nextBindingIndex();
    if (bindingUpdated(hostLView, bindingIndex, hasItemsInCollection)) {
      const emptyTemplateIndex = metadataSlotIdx + 2;
      const lContainer = getLContainer(hostLView, HEADER_OFFSET + emptyTemplateIndex);
      if (hasItemsInCollection) {
        removeLViewFromLContainer(lContainer, 0);
      } else {
        const emptyTemplateTNode = getExistingTNode(hostTView, emptyTemplateIndex);
        const embeddedLView =
            createAndRenderEmbeddedLView(hostLView, emptyTemplateTNode, undefined);
        addLViewToLContainer(lContainer, embeddedLView, 0);
      }
    }
  }
}

function getLContainer(lView: LView, index: number): LContainer {
  const lContainer = lView[index];
  ngDevMode && assertLContainer(lContainer);

  return lContainer;
}

function adjustToLastLContainerIndex(lContainer: LContainer, index: number|null): number {
  return index !== null ? index : lContainer.length - CONTAINER_HEADER_OFFSET;
}

function detachExistingView<T>(lContainer: LContainer, index: number): LView<T> {
  const existingLView = detachView(lContainer, index);
  ngDevMode && assertLView(existingLView);

  return existingLView as LView<T>;
}

function getExistingLViewFromLContainer<T>(lContainer: LContainer, index: number): LView<T> {
  const existingLView = getLViewFromLContainer<T>(lContainer, index);
  ngDevMode && assertLView(existingLView);

  return existingLView!;
}

function swapViews(lContainer: LContainer, startIdx: number, endIdx: number) {
  const endView = detachExistingView(lContainer, endIdx);
  const startView = detachExistingView(lContainer, startIdx);

  // TODO: adjust index in swapped views?
  addLViewToLContainer(lContainer, endView, startIdx);
  addLViewToLContainer(lContainer, startView, endIdx);
}

function getExistingTNode(tView: TView, index: number): TNode {
  const tNode = getTNode(tView, index + HEADER_OFFSET);
  ngDevMode && assertTNode(tNode);

  return tNode;
}
