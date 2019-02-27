/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {assertNumber} from '../util/assert';

import {attachPatchData} from './context_discovery';
import {NATIVE, VIEWS} from './interfaces/container';
import {TElementNode, TNode, TNodeFlags, TNodeType, TProjectionNode} from './interfaces/node';
import {RElement, RNode} from './interfaces/renderer';
import {LView, PARENT, T_HOST} from './interfaces/view';
import {addRemoveViewFromContainer, appendChild, insertChildBefore, renderChild} from './node_manipulation';
import {findComponentView, getLViewParent} from './util/view_traversal_utils';
import {getNativeByTNode, isLContainer} from './util/view_utils';



/**
 * Stack used to keep track of projection nodes in projection() instruction.
 *
 * This is deliberately created outside of projection() to avoid allocating
 * a new array each time the function is called. Instead the array will be
 * re-used by each invocation. This works because the function is not reentrant.
 */
export const projectionNodeStack: (LView | TNode)[] = [];

export function project(
    lView: LView, tProjectionNode: TProjectionNode, anchorNode: RNode | null,
    renderParent: RElement | null): void {
  // re-distribution of projectable nodes is stored on a component's view level
  const projectionSelectorIndex = tProjectionNode.projection as number;
  ngDevMode && assertNumber(projectionSelectorIndex, 'projection selector index must be a number');
  const componentView = findComponentView(lView);
  const componentNode = componentView[T_HOST] as TElementNode;
  const nodeToProject = componentNode.projection ![projectionSelectorIndex];
  let projectedLView = getLViewParent(componentView) !;
  let projectionNodeIndex = -1;

  if (Array.isArray(nodeToProject)) {
    renderChild(nodeToProject, lView, anchorNode, renderParent);
  } else {
    let currentNodeToProject: TNode|null = nodeToProject;
    while (currentNodeToProject) {
      if (currentNodeToProject.type === TNodeType.Projection) {
        // This node is re-projected, so we must go up the tree to get its projected nodes.
        const currentComponentView = findComponentView(projectedLView);
        const currentComponentHost = currentComponentView[T_HOST] as TElementNode;
        const firstProjectedNode: TNode|RNode[] =
            currentComponentHost.projection ![currentNodeToProject.projection as number];
        if (firstProjectedNode) {
          if (Array.isArray(firstProjectedNode)) {
            renderChild(firstProjectedNode, lView, anchorNode, renderParent);
          } else {
            projectionNodeStack[++projectionNodeIndex] = currentNodeToProject;
            projectionNodeStack[++projectionNodeIndex] = projectedLView;
            currentNodeToProject = firstProjectedNode;
            projectedLView = getLViewParent(currentComponentView) !;
            continue;
          }
        }
      } else {
        // This flag must be set now or we won't know that this node is projected
        // if the nodes are inserted into a container later.
        currentNodeToProject.flags |= TNodeFlags.isProjected;
        appendProjectedNode(
            currentNodeToProject, tProjectionNode, lView, projectedLView, anchorNode, renderParent);
      }
      // If we are finished with a list of re-projected nodes, we need to get
      // back to the root projection node that was re-projected.
      if (currentNodeToProject.next === null && projectedLView !== componentView[PARENT] !) {
        projectedLView = projectionNodeStack[projectionNodeIndex--] as LView;
        currentNodeToProject = projectionNodeStack[projectionNodeIndex--] as TNode;
      }
      currentNodeToProject = currentNodeToProject.next;
    }
  }
}


/**
 * Appends nodes to a target projection place. Nodes to insert were previously re-distribution and
 * stored on a component host level.
 * @param lView A LView where nodes are inserted (target VLview)
 * @param tProjectionNode A projection node where previously re-distribution should be appended
 * (target insertion place)
 * @param selectorIndex A bucket from where nodes to project should be taken
 * @param componentView A where projectable nodes were initially created (source view)
 */
export function appendProjectedNodes(
    lView: LView, tProjectionNode: TProjectionNode, selectorIndex: number, componentView: LView,
    anchorNode: RNode | null, renderParent: RNode | null): void {
  const projectedView = componentView[PARENT] !as LView;
  const componentNode = componentView[T_HOST] as TElementNode;
  let nodeToProject = (componentNode.projection as(TNode | null)[])[selectorIndex];

  if (Array.isArray(nodeToProject)) {
    appendChild(nodeToProject, tProjectionNode, lView);
  } else {
    while (nodeToProject) {
      if (nodeToProject.type === TNodeType.Projection) {
        appendProjectedNodes(
            lView, tProjectionNode, (nodeToProject as TProjectionNode).projection,
            findComponentView(projectedView), anchorNode, renderParent);
      } else {
        // This flag must be set now or we won't know that this node is projected
        // if the nodes are inserted into a container later.
        nodeToProject.flags |= TNodeFlags.isProjected;
        appendProjectedNode(
            nodeToProject, tProjectionNode, lView, projectedView, anchorNode, renderParent);
      }
      nodeToProject = nodeToProject.next;
    }
  }
}

/**
* Appends a projected node to the DOM, or in the case of a projected container,
* appends the nodes from all of the container's active views to the DOM.
*
* @param projectedTNode The TNode to be projected
* @param tProjectionNode The projection (ng-content) TNode
* @param currentView Current LView
* @param projectionView Projection view (view above current)
*/
function appendProjectedNode(
    projectedTNode: TNode, tProjectionNode: TNode, currentView: LView, projectionView: LView,
    anchorNode: RNode | null, renderParent: RNode | null): void {
  const native = getNativeByTNode(projectedTNode, projectionView);
  appendChild(native, tProjectionNode, currentView);

  // the projected contents are processed while in the shadow view (which is the currentView)
  // therefore we need to extract the view where the host element lives since it's the
  // logical container of the content projected views
  attachPatchData(native, projectionView);

  const nodeOrContainer = projectionView[projectedTNode.index];
  if (projectedTNode.type === TNodeType.Container) {
    // The node we are adding is a container and we are adding it to an element which
    // is not a component (no more re-projection).
    // Alternatively a container is projected at the root of a component's template
    // and can't be re-projected (as not content of any component).
    // Assign the final projection location in those cases.
    const views = nodeOrContainer[VIEWS];
    for (let i = 0; i < views.length; i++) {
      addRemoveViewFromContainer(views[i], true, nodeOrContainer[NATIVE]);
    }
  } else {
    if (projectedTNode.type === TNodeType.ElementContainer) {
      let ngContainerChildTNode: TNode|null = projectedTNode.child as TNode;
      while (ngContainerChildTNode) {
        appendProjectedNode(
            ngContainerChildTNode, tProjectionNode, currentView, projectionView, anchorNode,
            renderParent);
        ngContainerChildTNode = ngContainerChildTNode.next;
      }
    }

    if (isLContainer(nodeOrContainer)) {
      insertChildBefore(nodeOrContainer[NATIVE], tProjectionNode, currentView, anchorNode);
    }
  }
}
