/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Type} from '../../interface/type';
import {QueryList} from '../../linker';

import {TNode} from './node';
import {TView} from './view';

export interface TQueryMetadata {
  predicate: Type<any>|string[];
  descendants: boolean;
  read: any;
  isStatic: boolean
}

export interface TQuery {
  /**
   * Query metadata extracted from query annotations.
   */
  metadata: TQueryMetadata;

  parentQueryIndex: number;

  /**
   * Matches collected on the the first template pass. Each match is a pair of:
   * - TNode index
   * - match index (injectable index or -1 for the default read)
   */
  matches: number[]|null;

  // TODO(pk): document
  matchesTemplateDeclaration: boolean;

  elementStart(tView: TView, tNode: TNode): void;
  elementEnd(tNode: TNode): void;
  template(tView: TView, tNode: TNode): TQuery|null;
}

export interface TQueries {
  elementStart(tView: TView, tNode: TNode): void;
  elementEnd(tNode: TNode): void;
  template(tView: TView, tNode: TNode): TQueries|null;
  getByIndex(index: number): TQuery;
  track(tQuery: TQuery): void;
  length: number;
}

export interface LQuery<T> {
  matches: T|null[]|null;
  // TODO(pk): remove from the interface, introduce abstraction over storage (setDirty, first)
  // instead
  queryList: QueryList<T>;
  first: T;
}

export interface LQueries {
  queries: LQuery<any>[];
  declarationContainer(embeddedViewTQueries: TQueries): LQueries|null;
  createView(): LQueries;
  insertView(tView: TView): void;
  removeView(tView: TView): void;
}


// Note: This hack is necessary so we don't erroneously get a circular dependency
// failure based on types.
export const unusedValueExportToPlacateAjd = 1;
