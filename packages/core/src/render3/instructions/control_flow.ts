/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ɵɵtemplate} from '@angular/core';

import {DefaultIterableDiffer, IterableChangeRecord, TrackByFunction} from '../../change_detection';
import {assertDefined} from '../../util/assert';
import {assertLContainer, assertLView, assertTNode} from '../assert';
import {bindingUpdated} from '../bindings';
import {CONTAINER_HEADER_OFFSET, LContainer} from '../interfaces/container';
import {ComponentTemplate} from '../interfaces/definition';
import {TNode} from '../interfaces/node';
import {CONTEXT, HEADER_OFFSET, LView, TVIEW, TView} from '../interfaces/view';
import {detachView} from '../node_manipulation';
import {getLView, nextBindingIndex} from '../state';
import {getTNode} from '../util/view_utils';
import {addLViewToLContainer, createAndRenderEmbeddedLView, getLViewFromLContainer, removeLViewFromLContainer} from '../view_manipulation';

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

export function ɵɵrepeaterTrackByIndex(index: number) {
  return index;
}

export function ɵɵrepeaterTrackByIdentity<T>(_: number, value: T) {
  return value;
}

interface RepeaterMetadata<T> {
  hasEmptyBlock: boolean;
  differ: DefaultIterableDiffer<T>;
}

export function ɵɵrepeaterCreate<T>(
    index: number, templateFn: ComponentTemplate<any>, decls: number, vars: number,
    trackByFn: TrackByFunction<T>, emptyTemplateFn?: ComponentTemplate<any>, emptyDecls?: number,
    emptyVars?: number): void {
  ɵɵtemplate(index, templateFn, decls, vars);

  const hasEmptyBlock = emptyTemplateFn !== undefined;
  if (hasEmptyBlock) {
    ngDevMode &&
        assertDefined(emptyDecls, 'Missing number of declarations for the empty repeater block.');
    ngDevMode &&
        assertDefined(emptyVars, 'Missing number of bindings for the empty repeater block.');

    ɵɵtemplate(index + 1, emptyTemplateFn, decls, vars);
  }

  const hostLView = getLView();
  const metadata: RepeaterMetadata<T> = {
    hasEmptyBlock: emptyTemplateFn !== undefined,
    differ: new DefaultIterableDiffer(trackByFn),
  };
  hostLView[HEADER_OFFSET + (hasEmptyBlock ? 2 : 1)] = metadata;
}


/**
 * @codeGenApi
 */
// TODO: exact type for the collection? Should be the same as NgFor, right? Need the U type?
export function ɵɵrepeater<T>(
    metadataSlotIdx: number, collection: Iterable<T>|undefined|null): void {
  const hostLView = getLView();
  const hostTView = hostLView[TVIEW];
  const metadata = hostLView[HEADER_OFFSET + metadataSlotIdx] as RepeaterMetadata<T>;
  const containerAdjustedIndex =
      HEADER_OFFSET + metadataSlotIdx + (metadata.hasEmptyBlock ? -2 : -1);

  const tContainer = getExistingTNode(hostTView, containerAdjustedIndex - HEADER_OFFSET);
  const differ = metadata.differ;

  const prevLen = differ.length;
  const changes = differ.diff(collection);
  const newLen = differ.length;

  // remove empty block if needed
  if (metadata.hasEmptyBlock && prevLen === 0 && newLen > 0) {
    const lContainer = getLContainer(hostLView, containerAdjustedIndex);
    removeLViewFromLContainer(lContainer, 0);
  }

  if (changes !== null) {
    const lContainer = getLContainer(hostLView, containerAdjustedIndex);
    let needsIndexUpdate = false;
    changes.forEachOperation(
        (item: IterableChangeRecord<T>, adjustedPreviousIndex: number|null,
         currentIndex: number|null) => {
          if (item.previousIndex == null) {
            // add
            const newViewIdx = adjustToLastLContainerIndex(lContainer, currentIndex);
            const embeddedLView = createAndRenderEmbeddedLView(
                hostLView, tContainer, new RepeaterContext(lContainer, item.item, newViewIdx));
            addLViewToLContainer(lContainer, embeddedLView, newViewIdx);
            needsIndexUpdate = true;
          } else if (currentIndex == null) {
            // remove
            adjustedPreviousIndex = adjustToLastLContainerIndex(lContainer, adjustedPreviousIndex);
            removeLViewFromLContainer(lContainer, adjustedPreviousIndex);
            needsIndexUpdate = true;
          } else if (adjustedPreviousIndex !== null) {
            // move
            const existingLView =
                detachExistingView<RepeaterContext<T>>(lContainer, adjustedPreviousIndex);
            addLViewToLContainer(lContainer, existingLView, currentIndex);
            needsIndexUpdate = true;
          }
        });

    // A trackBy function might return the same value even if the underlying item changed - re-bind
    // it in the context.
    changes.forEachIdentityChange((record: IterableChangeRecord<T>) => {
      const viewIdx = adjustToLastLContainerIndex(lContainer, record.currentIndex);
      const lView = getExistingLViewFromLContainer<RepeaterContext<T>>(lContainer, viewIdx);
      const ctx = lView[CONTEXT];
      ctx.$implicit = record.item;
    });

    // moves in the container might caused context's index to get out of order, re-adjust
    // PERF(pk): this is very basic method of dealing with the problem, can we do better? Ex.:
    // capture usage of index-related fields from the context?
    if (needsIndexUpdate) {
      for (let i = 0; i < lContainer.length - CONTAINER_HEADER_OFFSET; i++) {
        const lView = getExistingLViewFromLContainer<RepeaterContext<T>>(lContainer, i);
        const ctx = lView[CONTEXT];
        ctx.$index = i;
      }
    }
  }

  // add empty block if needed
  if (metadata.hasEmptyBlock && prevLen > 0 && newLen === 0) {
    const lContainer = getLContainer(hostLView, containerAdjustedIndex);
    const tNode = getExistingTNode(hostTView, containerAdjustedIndex + 1 - HEADER_OFFSET);
    // DESIGN: anything in the context of this view?
    const embeddedLView = createAndRenderEmbeddedLView(hostLView, tNode, {});
    addLViewToLContainer(lContainer, embeddedLView, 0);
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

function getExistingTNode(tView: TView, index: number): TNode {
  const tNode = getTNode(tView, index + HEADER_OFFSET);
  ngDevMode && assertTNode(tNode);

  return tNode;
}
