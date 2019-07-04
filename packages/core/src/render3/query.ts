/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// We are temporarily importing the existing viewEngine_from core so we can be sure we are
// correctly implementing its interfaces for backwards compatibility.

import {Type} from '../interface/type';
import {ElementRef as ViewEngine_ElementRef} from '../linker/element_ref';
import {QueryList} from '../linker/query_list';
import {TemplateRef as ViewEngine_TemplateRef} from '../linker/template_ref';
import {ViewContainerRef} from '../linker/view_container_ref';
import {assertDataInRange, assertDefined, assertEqual} from '../util/assert';

import {assertPreviousIsParent} from './assert';
import {getNodeInjectable, locateDirectiveOrProvider} from './di';
import {NG_ELEMENT_ID} from './fields';
import {store} from './instructions/all';
import {storeCleanupWithContext} from './instructions/shared';
import {CONTAINER_HEADER_OFFSET, LContainer} from './interfaces/container';
import {unusedValueExportToPlacateAjd as unused1} from './interfaces/definition';
import {unusedValueExportToPlacateAjd as unused2} from './interfaces/injector';
import {TContainerNode, TElementContainerNode, TElementNode, TNode, TNodeType, unusedValueExportToPlacateAjd as unused3} from './interfaces/node';
import {LQueries, LQuery, TQueries, TQuery, TQueryMetadata, unusedValueExportToPlacateAjd as unused4} from './interfaces/query';
import {HEADER_OFFSET, LView, QUERIES, TVIEW, TView} from './interfaces/view';
import {getCurrentQueryIndex, getIsParent, getLView, getPreviousOrParentTNode, isCreationMode, setCurrentQueryIndex} from './state';
import {createContainerRef, createElementRef, createTemplateRef} from './view_engine_compatibility';

const unusedValueToPlacateAjd = unused1 + unused2 + unused3 + unused4;

class LQuery2_<T> implements LQuery<T> {
  matches: T|null[]|null = null;
  // PERF(pk): we shouldn't need queryList here, it boils down to instructions setup
  constructor(public queryList: QueryList<T>) {}
  get first(): T { return this.queryList.first; }
}

class LQueries2_ implements LQueries {
  constructor(public queries: LQuery<any>[] = []) {}

  declarationContainer(embeddedViewTQueries: TQueries): LQueries|null {
    const containerLQueries: LQuery<any>[] = new Array(embeddedViewTQueries.queries.length);

    for (let i = 0; i < embeddedViewTQueries.queries.length; i++) {
      const tQuery = embeddedViewTQueries.queries[i];
      const parentLQuery = this.queries ![tQuery.parentQueryIndex];
      containerLQueries[i] = new LQuery2_(parentLQuery.queryList);
    }

    return new LQueries2_(containerLQueries);
  }

  createView(): LQueries {
    const viewLQueries: LQuery<any>[] = new Array(this.queries.length);

    for (let i = 0; i < this.queries.length; i++) {
      viewLQueries[i] = new LQuery2_(this.queries[i].queryList)
    }

    return new LQueries2_(viewLQueries);
  }

  insertView(tView: TView): void { this.dirtyQueriesWithMatches(tView); }

  removeView(tView: TView): void { this.dirtyQueriesWithMatches(tView); }

  private dirtyQueriesWithMatches(tView: TView) {
    for (let i = 0; i < this.queries.length; i++) {
      const lQuery = this.queries[i];
      // TODO(pk): assert (or better yet, create a getter)
      const tQuery = tView.tqueries !.queries[i];
      // TODO(pk): firstTemplatePass check is here since the view insertion happens before a
      // template is processed
      // I think that this is another bug that I should fix via
      // https://github.com/angular/angular/pull/31312 - remove this check when the mentioned PR
      // lands
      if (tView.firstTemplatePass || tQuery.matches !== null) {
        lQuery.queryList.setDirty();
      }
    }
  }
}

function getSelectorMatchingIdx(tNode: TNode, selector: string[]): number|null {
  for (let i = 0; i < selector.length; i++) {
    const matchingIdx = getIdxOfMatchingSelector(tNode, selector[i]);
    if (matchingIdx !== null) {
      return matchingIdx;
    }
  }
  return null;
}

class TQueryMetadata_ implements TQueryMetadata {
  constructor(
      public predicate: Type<any>|string[], public descendants: boolean, public read: any,
      public isStatic: boolean) {}
}

class TQueries_ implements TQueries {
  constructor(public queries: TQuery[] = []) {}

  elementStart(tView: TView, tNode: TNode): void {
    for (let query of this.queries) {
      query.elementStart(tView, tNode);
    }
  }
  elementEnd(tNode: TNode): void {
    for (let query of this.queries) {
      query.elementEnd(tNode);
    }
  }
  template(tView: TView, tNode: TNode): TQueries|null {
    let queriesForTemplateRef: TQuery[]|null = null;

    for (let i = 0; i < this.queries.length; i++) {
      const tquery = this.queries[i];
      const tqueryClone = tquery.template(tView, tNode);
      if (tqueryClone) {
        tqueryClone.parentQueryIndex = i;
        if (queriesForTemplateRef !== null) {
          queriesForTemplateRef.push(tqueryClone);
        } else {
          queriesForTemplateRef = [tqueryClone];
        }
      }
    }

    return queriesForTemplateRef !== null ? new TQueries_(queriesForTemplateRef) : null;
  }
}

class TQuery_ implements TQuery {
  parentQueryIndex = -1;
  matches: number[]|null = null;
  matchesTemplateDeclaration = false;

  /**
   * A node index on which a query was declared (-1 for view queries and ones inherited from the
   * declaration template). We use this index (alongside with _appliesToNextNode flag) to know
   * when
   * to apply content queries to elements in a template.
   */
  private _declarationNodeIndex: number;

  /**
   * A flag indicating if a given still applies to nodes it is crossing. We use this flag
   * (alongside
   * with _declarationNodeIndex) to know when to stop applying content queries to elements in a
   * template.
   */
  private _appliesToNextNode = true;

  constructor(public metadata: TQueryMetadata, nodeIndex: number = -1) {
    this._declarationNodeIndex = nodeIndex;
  }

  elementStart(tView: TView, tNode: TNode): void {
    if (this.isApplyingToNode(tNode)) {
      this.addMatch(tNode.index, this.getMatchIndex(tView, tNode));
    }
  }

  elementEnd(tNode: TNode): void {
    if (this._declarationNodeIndex === tNode.index) {
      this._appliesToNextNode = false;
    }
  }

  template(tView: TView, tNode: TNode): TQuery|null {
    if (this.isApplyingToNode(tNode)) {
      // add a template node if it matches
      this.addMatch(tNode.index, this.getMatchIndex(tView, tNode));
      // add a TemplateRef marker
      this.addMatch(-tNode.index, -1);
      this.matchesTemplateDeclaration = true;
      return new TQuery_(this.metadata);
    }
    return null;
  }

  private isApplyingToNode(tNode: TNode): boolean {
    if (this._appliesToNextNode && this.metadata.descendants === false) {
      return this._declarationNodeIndex === (tNode.parent ? tNode.parent.index : -1);
    }
    return this._appliesToNextNode;
  }

  private getMatchIndex(tView: TView, tNode: TNode): number|null {
    let matchIdx: number|null = null;
    if (Array.isArray(this.metadata.predicate)) {
      matchIdx = getSelectorMatchingIdx(tNode, this.metadata.predicate as string[]);
    } else {
      const typePredicate = this.metadata.predicate as any;
      if (typePredicate === ViewEngine_TemplateRef) {
        matchIdx = tNode.type === TNodeType.Container ? -1 : null;
      } else {
        matchIdx = locateDirectiveOrProvider(tNode, tView, typePredicate, false, false)
      }
    }
    const read = this.metadata.read;
    if (matchIdx !== null && read != null) {
      if (read === ViewEngine_ElementRef || read === ViewContainerRef ||
          read === ViewEngine_TemplateRef && tNode.type === TNodeType.Container) {
        matchIdx = -2;
      } else {
        matchIdx = locateDirectiveOrProvider(tNode, tView, this.metadata.read, false, false);
      }
    }
    return matchIdx;
  }

  private addMatch(tNodeIdx: number, matchIdx: number|null) {
    if (matchIdx !== null) {
      if (this.matches === null) this.matches = [];
      this.matches.push(tNodeIdx, matchIdx);
    }
  }
}

/**
 * Iterates over local names for a given node and returns directive index
 * (or -1 if a local name points to an element).
 *
 * @param tNode static data of a node to check
 * @param selector selector to match
 * @returns directive index, -1 or null if a selector didn't match any of the local names
 */
function getIdxOfMatchingSelector(tNode: TNode, selector: string): number|null {
  const localNames = tNode.localNames;
  if (localNames) {
    for (let i = 0; i < localNames.length; i += 2) {
      if (localNames[i] === selector) {
        return localNames[i + 1] as number;
      }
    }
  }
  return null;
}


function queryByTNodeType(tNode: TNode, currentView: LView): any {
  if (tNode.type === TNodeType.Element || tNode.type === TNodeType.ElementContainer) {
    return createElementRef(ViewEngine_ElementRef, tNode, currentView);
  } else if (tNode.type === TNodeType.Container) {
    return createTemplateRef(ViewEngine_TemplateRef, ViewEngine_ElementRef, tNode, currentView);
  }
  return null;
}


function materializeNodeResult(lView: LView, tNode: TNode, matchingIdx: number, read: any): any {
  if (matchingIdx === -1) {
    // if read token and / or strategy is not specified, detect it using appropriate tNode type
    return queryByTNodeType(tNode, lView);
  } else if (matchingIdx === -2) {
    if (read === ViewEngine_ElementRef) {
      return createElementRef(ViewEngine_ElementRef, tNode, lView);
    } else if (read === ViewEngine_TemplateRef) {
      return createTemplateRef(ViewEngine_TemplateRef, ViewEngine_ElementRef, tNode, lView);
    } else if (read === ViewContainerRef) {
      // TODO(pk): assert on potential node type
      return createContainerRef(
          ViewContainerRef, ViewEngine_ElementRef,
          tNode as TElementNode | TContainerNode | TElementContainerNode, lView);
    } else {
      // TODO(pk): assert on special token type or throw here (dev mode only)
    }
  } else {
    // assert matchingIdx > -1 (dev mode only) - or assert not 0 earlier on
    return getNodeInjectable(lView[TVIEW].data, lView, matchingIdx, tNode as TElementNode);
  }
}

function materializeViewResults<T>(lView: LView, tQuery: TQuery, lQuery: LQuery<T>): T|null[] {
  const tView = lView[TVIEW];
  if (lQuery.matches === null) {
    // TODO(pk): assert that tQueryMatches is not null
    const tQueryMatches = tQuery.matches !;
    const result: T|null[] = new Array(tQueryMatches.length / 2);
    for (let i = 0; i < tQueryMatches.length; i += 2) {
      const matchedNodeIdx = tQueryMatches[i];
      if (matchedNodeIdx < 0) {
        result[i / 2] = null;
      } else {
        // TODO(pk): assert on index and TNode
        const tNode = tView.data[matchedNodeIdx] as TNode;
        result[i / 2] =
            materializeNodeResult(lView, tNode, tQueryMatches[i + 1], tQuery.metadata.read);
      }
    }
    lQuery.matches = result;
  }

  return lQuery.matches;
}

function buildQueryResults<T>(lView: LView, queryIndex: number, result?: T[]): T[] {
  const tView = lView[TVIEW];
  // TODO(pk): assert that tqueries is not null
  const tQuery = tView.tqueries !.queries[queryIndex];

  if (tQuery.matches !== null) {
    const lQuery = lView[QUERIES] !.queries ![queryIndex];
    const lViewResults = materializeViewResults(lView, tQuery, lQuery);

    if (!tQuery.matchesTemplateDeclaration && result === undefined) {
      // This particular query didn't match any <ng-template> elements in a view where the query was
      // declared. In this case we will never have results from embedded views so can just return
      // results from the query declaration view.
      return lViewResults;
    } else {
      result = result !== undefined ? result : [];
      for (let i = 0; i < tQuery.matches.length; i += 2) {
        const tNodeIdx = tQuery.matches[i];
        if (tNodeIdx > 0) {
          result.push(lViewResults[i / 2]);
        } else {
          // TODO(pk): assert on index and type
          const declarationLContainer = lView[-tNodeIdx] as LContainer;
          // TODO(pk): for now assume that the declaration and insertion point is the same
          for (let j = CONTAINER_HEADER_OFFSET; j < declarationLContainer.length; j++) {
            const embeddedLView = declarationLContainer[j];
            buildQueryResults(embeddedLView, queryIndex, result);
          }
        }
      }
      return result;
    }
  }

  // TODO(pk): can I re-use the same array - I think so!
  return [];
}

/**
 * Refreshes a query by combining matches from all active views and removing matches from deleted
 * views.
 *
 * @returns `true` if a query got dirty during change detection or if this is a static query
 * resolving in creation mode, `false` otherwise.
 *
 * @codeGenApi
 */
export function ɵɵqueryRefresh(queryList: QueryList<any>): boolean {
  const lView = getLView();
  const tView = lView[TVIEW];
  const queryIndex = getCurrentQueryIndex();

  setCurrentQueryIndex(queryIndex + 1);

  // TODO(pk): I definitivelly need a getter or sth else here
  const tQuery = tView.tqueries !.queries[queryIndex];

  if (queryList.dirty && (isCreationMode() === tQuery.metadata.isStatic)) {
    // PERF(pk): we are building a flattened version of the matches so no need to flatten it again
    queryList.reset(buildQueryResults(lView, queryIndex));
    queryList.notifyOnChanges();
    return true;
  }

  return false;
}

/**
 * Creates new QueryList for a static view query.
 *
 * @param predicate The type for which the query will search
 * @param descend Whether or not to descend into children
 * @param read What to save in the query
 *
 * @codeGenApi
 */
export function ɵɵstaticViewQuery<T>(
    predicate: Type<any>| string[], descend: boolean, read: any): void {
  viewQueryInternal(getLView(), predicate, descend, read, true);
}

/**
 * Creates new QueryList, stores the reference in LView and returns QueryList.
 *
 * @param predicate The type for which the query will search
 * @param descend Whether or not to descend into children
 * @param read What to save in the query
 *
 * @codeGenApi
 */
export function ɵɵviewQuery<T>(predicate: Type<any>| string[], descend: boolean, read: any): void {
  viewQueryInternal(getLView(), predicate, descend, read, false);
}

function viewQueryInternal<T>(
    lView: LView, predicate: Type<any>| string[], descend: boolean, read: any,
    isStatic: boolean): void {
  const tView = lView[TVIEW];
  if (tView.firstTemplatePass) {
    createTQuery(tView, new TQueryMetadata_(predicate, descend, read, isStatic), -1);
    if (isStatic) {
      tView.staticViewQueries = true;
    }
  }
  createLQuery<T>(lView);
}

/**
 * Loads a QueryList corresponding to the current view query.
 *
 * @codeGenApi
 */
export function ɵɵloadViewQuery<T>(): QueryList<T> {
  return loadQueryInternal<T>(getLView(), getCurrentQueryIndex());
}

/**
 * Registers a QueryList, associated with a content query, for later refresh (part of a view
 * refresh).
 *
 * @param directiveIndex Current directive index
 * @param predicate The type for which the query will search
 * @param descend Whether or not to descend into children
 * @param read What to save in the query
 * @returns QueryList<T>
 *
 * @codeGenApi
 */
export function ɵɵcontentQuery<T>(
    directiveIndex: number, predicate: Type<any>| string[], descend: boolean, read: any): void {
  contentQueryInternal(
      getLView(), predicate, descend, read, false, getPreviousOrParentTNode(), directiveIndex);
}

/**
 * Registers a QueryList, associated with a static content query, for later refresh
 * (part of a view refresh).
 *
 * @param directiveIndex Current directive index
 * @param predicate The type for which the query will search
 * @param descend Whether or not to descend into children
 * @param read What to save in the query
 * @returns QueryList<T>
 *
 * @codeGenApi
 */
export function ɵɵstaticContentQuery<T>(
    directiveIndex: number, predicate: Type<any>| string[], descend: boolean, read: any): void {
  contentQueryInternal(
      getLView(), predicate, descend, read, true, getPreviousOrParentTNode(), directiveIndex);
}

function contentQueryInternal<T>(
    lView: LView, predicate: Type<any>| string[], descend: boolean, read: any, isStatic: boolean,
    tNode: TNode, directiveIndex: number): void {
  const tView = lView[TVIEW];
  if (tView.firstTemplatePass) {
    createTQuery(tView, new TQueryMetadata_(predicate, descend, read, isStatic), tNode.index);
    saveContentQueryAndDirectiveIndex(tView, directiveIndex);
    if (isStatic) {
      tView.staticContentQueries = true;
    }
  }

  createLQuery<T>(lView);
}

/**
 * Loads a QueryList corresponding to the current content query.
 *
 * @codeGenApi
 */
export function ɵɵloadContentQuery<T>(): QueryList<T> {
  return loadQueryInternal<T>(getLView(), getCurrentQueryIndex());
}

function loadQueryInternal<T>(lView: LView, queryIndex: number): QueryList<T> {
  // TODO(pk): asserts (presence of queries, index)
  return lView[QUERIES] !.queries[queryIndex].queryList;
}

function createLQuery<T>(lView: LView) {
  if (lView[QUERIES] === null) lView[QUERIES] = new LQueries2_();
  lView[QUERIES] !.queries.push(new LQuery2_(new QueryList<T>()));
}

function createTQuery(tView: TView, metadata: TQueryMetadata, nodeIndex: number): void {
  if (tView.tqueries === null) tView.tqueries = new TQueries_();
  tView.tqueries.queries.push(new TQuery_(metadata, nodeIndex));
}

function saveContentQueryAndDirectiveIndex(tView: TView, directiveIndex: number) {
  const tViewContentQueries = tView.contentQueries || (tView.contentQueries = []);
  const lastSavedDirectiveIndex =
      tView.contentQueries.length ? tViewContentQueries[tViewContentQueries.length - 1] : -1;
  if (directiveIndex !== lastSavedDirectiveIndex) {
    tViewContentQueries.push(tView.tqueries !.queries.length - 1, directiveIndex);
  }
}