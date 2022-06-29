/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {RendererStyleFlags2, RendererType2} from '../../render/api_flags';
import {TrustedHTML, TrustedScript, TrustedScriptURL} from '../../util/security/trusted_type_defs';

import {RComment, RElement, RNode, RText} from './renderer_dom';

// TODO: cleanup once the code is merged in angular/angular
export enum RendererStyleFlags3 {
  Important = 1 << 0,
  DashCase = 1 << 1
}

export type GlobalTargetName = 'document'|'window'|'body';

export type GlobalTargetResolver = (element: any) => EventTarget;

/**
 * Procedural style of API needed to create elements and text nodes.
 *
 * In non-native browser environments (e.g. platforms such as web-workers), this is the
 * facade that enables element manipulation. This also facilitates backwards compatibility
 * with Renderer2.
 */
export interface ProceduralRenderer3 {
  destroy(): void;
  createComment(value: string): RComment;
  createElement(name: string, namespace?: string|null): RElement;
  createText(value: string): RText;
  /**
   * This property is allowed to be null / undefined,
   * in which case the view engine won't call it.
   * This is used as a performance optimization for production mode.
   */
  destroyNode?: ((node: RNode) => void)|null;
  appendChild(parent: RElement, newChild: RNode): void;
  insertBefore(parent: RNode, newChild: RNode, refChild: RNode|null, isMove?: boolean): void;
  removeChild(parent: RElement, oldChild: RNode, isHostElement?: boolean): void;
  selectRootElement(selectorOrNode: string|any, preserveContent?: boolean): RElement;

  parentNode(node: RNode): RElement|null;
  nextSibling(node: RNode): RNode|null;

  setAttribute(
      el: RElement, name: string, value: string|TrustedHTML|TrustedScript|TrustedScriptURL,
      namespace?: string|null): void;
  removeAttribute(el: RElement, name: string, namespace?: string|null): void;
  addClass(el: RElement, name: string): void;
  removeClass(el: RElement, name: string): void;
  setStyle(
      el: RElement, style: string, value: any,
      flags?: RendererStyleFlags2|RendererStyleFlags3): void;
  removeStyle(el: RElement, style: string, flags?: RendererStyleFlags2|RendererStyleFlags3): void;
  setProperty(el: RElement, name: string, value: any): void;
  setValue(node: RText|RComment, value: string): void;

  // TODO(misko): Deprecate in favor of addEventListener/removeEventListener
  listen(
      target: GlobalTargetName|RNode, eventName: string,
      callback: (event: any) => boolean | void): () => void;
}

export interface RendererFactory3 {
  createRenderer(hostElement: RElement|null, rendererType: RendererType2|null): ProceduralRenderer3;
  begin?(): void;
  end?(): void;
}

// Note: This hack is necessary so we don't erroneously get a circular dependency
// failure based on types.
export const unusedValueExportToPlacateAjd = 1;
