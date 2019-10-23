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
import {RComment} from '../../../src/render3/interfaces/renderer';
import {LView, LViewFlags, RENDERER, RENDERER_FACTORY, TView} from '../../../src/render3/interfaces/view';
import {insertView} from '../../../src/render3/node_manipulation';

import {NoopRenderer, NoopRendererFactory, WebWorkerRenderNode} from './noop_renderer';

export function createAndRenderLView(
    parentLView: LView | null, tView: TView, hostTNode: TViewNode) {
  const embeddedLView = createLView(
      parentLView, tView, {}, LViewFlags.CheckAlways, null, hostTNode, new NoopRendererFactory(),
      new NoopRenderer());
  renderView(embeddedLView, tView, null);
}

export function setupRootViewWithEmbeddedViews(
    templateFn: ComponentTemplate<any>| null, decls: number, vars: number, noOfViews: number,
    embeddedViewContext: any = {}, consts: TAttributes[] | null = null): LView {
  return setupTestHarness(templateFn, decls, vars, noOfViews, embeddedViewContext, consts)
      .hostLView;
}

export interface TestHarness {
  hostLView: LView, hostTView: TView, embeddedTView: TView, createEmbeddedLView(): LView,
      detectChanges(): void;
}

export function setupTestHarness(
    templateFn: ComponentTemplate<any>| null, decls: number, vars: number, noOfViews: number,
    embeddedViewContext: any = {}, consts: TAttributes[] | null = null): TestHarness {
  // Create a root view with a container
  const hostTView = createTView(-1, null, 1, 0, null, null, null, null, consts);
  const tContainerNode = getOrCreateTNode(hostTView, null, 0, TNodeType.Container, null, null);
  const hostLView = createLView(
      null, hostTView, {}, LViewFlags.CheckAlways | LViewFlags.IsRoot, null, null,
      new NoopRendererFactory(), new NoopRenderer());
  const mockRNode = new WebWorkerRenderNode();
  const lContainer = createLContainer(
      mockRNode as RComment, hostLView, mockRNode as RComment, tContainerNode, true);
  addToViewTree(hostLView, lContainer);


  // create test embedded views
  const embeddedTView = createTView(-1, templateFn, decls, vars, null, null, null, null, consts);
  const viewTNode = createTNode(hostTView, null, TNodeType.View, -1, null, null) as TViewNode;
  const rendererFactory = hostLView[RENDERER_FACTORY];
  const renderer = hostLView[RENDERER];

  function createEmbeddedLView(): LView {
    const embeddedLView = createLView(
        hostLView, embeddedTView, embeddedViewContext, LViewFlags.CheckAlways, null, viewTNode,
        rendererFactory, renderer);
    renderView(embeddedLView, embeddedTView, null);
    return embeddedLView;
  }

  function detectChanges(): void { renderView(hostLView, hostTView, null); }

  // create embedded views and add them to the container
  for (let i = 0; i < noOfViews; i++) {
    insertView(createEmbeddedLView(), lContainer, i);
  }

  // run in the creation mode to set flags etc.
  detectChanges();

  return {
    hostLView: hostLView,
    hostTView: hostTView,
    embeddedTView: embeddedTView,
    createEmbeddedLView: createEmbeddedLView,
    detectChanges: detectChanges,
  };
}
