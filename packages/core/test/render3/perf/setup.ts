/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {addToViewTree, createLContainer, createLView, createTNode, createTView, getOrCreateTNode, renderView} from '../../../src/render3/instructions/shared';
import {ComponentTemplate} from '../../../src/render3/interfaces/definition';
import {TAttributes, TNodeType, TViewNode} from '../../../src/render3/interfaces/node';
import {RComment, RElement, RendererFactory3, domRendererFactory3} from '../../../src/render3/interfaces/renderer';
import {LView, LViewFlags, TView} from '../../../src/render3/interfaces/view';
import {insertView} from '../../../src/render3/node_manipulation';

import {NoopRendererFactory, WebWorkerRenderNode} from './noop_renderer';

const isBrowser = typeof process === 'undefined';
const DomOrMockDivNode =
    (isBrowser ?  // In browser testing use real DOM
         function() { return document.createElement('div'); } as unknown :
         WebWorkerRenderNode) as{new (): RElement};
const DomOrMockCommentNode =
    (isBrowser ?  // In browser testing use real DOM
         Comment :
         WebWorkerRenderNode) as{new (): RComment};
const rendererFactory: RendererFactory3 = isBrowser ? domRendererFactory3 : new NoopRendererFactory;
const renderer = rendererFactory.createRenderer(null, null);

export function createAndRenderLView(
    parentLView: LView | null, tView: TView, hostTNode: TViewNode) {
  const embeddedLView = createLView(
      parentLView, tView, {}, LViewFlags.CheckAlways, null, hostTNode, rendererFactory, renderer);
  renderView(embeddedLView, tView, null);
}

export function setupRootViewWithEmbeddedViews(
    templateFn: ComponentTemplate<any>| null, decls: number, vars: number, noOfViews: number,
    embeddedViewContext: any = {}, consts: TAttributes[] | null = null): LView {
  // Create a root view with a container
  const rootTView = createTView(-1, null, 1, 0, null, null, null, null, consts);
  const tContainerNode = getOrCreateTNode(rootTView, null, 0, TNodeType.Container, null, null);
  const hostNode = new DomOrMockDivNode();
  const rootLView = createLView(
      null, rootTView, {}, LViewFlags.CheckAlways | LViewFlags.IsRoot, hostNode, null,
      rendererFactory, renderer);
  const mockRCommentNode = new DomOrMockCommentNode();
  const lContainer =
      createLContainer(mockRCommentNode, rootLView, mockRCommentNode, tContainerNode, true);
  addToViewTree(rootLView, lContainer);


  // create test embedded views
  const embeddedTView = createTView(-1, templateFn, decls, vars, null, null, null, null, null);
  const viewTNode = createTNode(rootTView, null, TNodeType.View, -1, null, null) as TViewNode;

  // create embedded views and add them to the container
  for (let i = 0; i < noOfViews; i++) {
    const embeddedLView = createLView(
        rootLView, embeddedTView, embeddedViewContext, LViewFlags.CheckAlways, null, viewTNode,
        rendererFactory, renderer);
    renderView(embeddedLView, embeddedTView, null);
    insertView(embeddedLView, lContainer, i);
  }

  // run in the creation mode to set flags etc.
  renderView(rootLView, rootTView, null);

  return rootLView;
}
