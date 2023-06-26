/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';

import type {ComponentCompilation, ViewCompilation} from '../compilation';

/**
 * Generate a preamble sequence for each view creation block and listener function which declares
 * any variables that be referenced in other operations in the block.
 *
 * Variables generated include:
 *   * a saved view context to be used to restore the current view in event listeners.
 *   * the context of the restored view within event listener handlers.
 *   * context variables from the current view as well as all parent views (including the root
 *     context if needed).
 *   * local references from elements within the current view and any lexical parents.
 *
 * Variables are generated here unconditionally, and may optimized away in future operations if it
 * turns out their values (and any side effects) are unused.
 */
export function phaseGenerateVariables(cpl: ComponentCompilation): void {
  recursivelyProcessView(cpl.root, /* there is no parent scope for the root view */ null);
}

/**
 * Process the given `ViewCompilation` and generate preambles for it and any listeners that it
 * declares.
 *
 * @param `parentScope` a scope extracted from the parent view which captures any variables which
 *     should be inherited by this view. `null` if the current view is the root view.
 */
function recursivelyProcessView(view: ViewCompilation, parentScope: Scope|null): void {
  // Extract a `Scope` from this view.
  const scope = getScopeForView(view, parentScope);

  for (const op of view.create) {
    switch (op.kind) {
      case ir.OpKind.Template:
        // Descend into child embedded views.
        recursivelyProcessView(view.tpl.views.get(op.xref)!, scope);
        break;
      case ir.OpKind.Listener:
        // Prepend variables to listener handler functions.
        op.handlerOps.prepend(generateVariablesInScopeForView(view, scope));
        break;
    }
  }

  // Prepend the declarations for all available variables in scope to both blocks.
  view.create.prepend(generateVariablesInScopeForView(view, scope));
  view.update.prepend(generateVariablesInScopeForView(view, scope));
}

/**
 * Lexical scope of a view, including a reference to its parent view's scope, if any.
 */
interface Scope {
  /**
   * `XrefId` of the view to which this scope corresponds.
   */
  view: ir.XrefId;

  viewContextVariable: ir.SemanticVariable;

  contextVariables: Map<string, ir.SemanticVariable>;

  /**
   * Local references collected from elements within the view.
   */
  references: Reference[];

  /**
   * `Scope` of the parent view, if any.
   */
  parent: Scope|null;
}

/**
 * Information needed about a local reference collected from an element within a view.
 */
interface Reference {
  /**
   * Name given to the local reference variable within the template.
   *
   * This is not the name which will be used for the variable declaration in the generated
   * template code.
   */
  name: string;

  /**
   * `XrefId` of the element-like node which this reference targets.
   *
   * The reference may be either to the element (or template) itself, or to a directive on it.
   */
  targetId: ir.XrefId;

  /**
   * A generated offset of this reference among all the references on a specific element.
   */
  offset: number;

  variable: ir.SemanticVariable;
}

/**
 * Process a view and generate a `Scope` representing the variables available for reference within
 * that view.
 */
function getScopeForView(view: ViewCompilation, parent: Scope|null): Scope {
  const scope: Scope = {
    view: view.xref,
    viewContextVariable: {
      kind: ir.SemanticVariableKind.Context,
      name: null,
      view: view.xref,
    },
    contextVariables: new Map<string, ir.SemanticVariable>(),
    references: [],
    parent,
  };

  for (const identifier of view.contextVariables.keys()) {
    scope.contextVariables.set(identifier, {
      kind: ir.SemanticVariableKind.Identifier,
      name: null,
      identifier,
      target: null,
    });
  }

  for (const op of view.create) {
    switch (op.kind) {
      case ir.OpKind.Element:
      case ir.OpKind.ElementStart:
      case ir.OpKind.Template:
        if (!Array.isArray(op.localRefs)) {
          throw new Error(`AssertionError: expected localRefs to be an array`);
        }

        // Record available local references from this element.
        for (let offset = 0; offset < op.localRefs.length; offset++) {
          scope.references.push({
            name: op.localRefs[offset].name,
            targetId: op.xref,
            offset,
            variable: {
              kind: ir.SemanticVariableKind.Identifier,
              name: null,
              identifier: op.localRefs[offset].name,
              target: op.xref,
            },
          });
        }
        break;
    }
  }

  return scope;
}

/**
 * Generate declarations for all variables that are in scope for a given view.
 *
 * This is a recursive process, as views inherit variables available from their parent view, which
 * itself may have inherited variables, etc.
 */
function generateVariablesInScopeForView<OpT extends ir.Op<OpT>>(
    view: ViewCompilation, scope: Scope): ir.VariableOp<OpT>[] {
  const newOps: ir.VariableOp<OpT>[] = [];

  if (scope.view !== view.xref) {
    // Before generating variables for a parent view, we need to switch to the context of the parent
    // view with a `nextContext` expression. This context switching operation itself declares a
    // variable, because the context of the view may be referenced directly.
    newOps.push(ir.createVariableOp(
        view.tpl.allocateXrefId(), scope.viewContextVariable, new ir.NextContextExpr()));
  }

  // Add variables for all context variables available in this scope's view.
  for (const [name, value] of view.tpl.views.get(scope.view)!.contextVariables) {
    newOps.push(ir.createVariableOp(
        view.tpl.allocateXrefId(), scope.contextVariables.get(name)!,
        new o.ReadPropExpr(new ir.ContextExpr(scope.view), value)));
  }

  // Add variables for all local references declared for elements in this scope.
  for (const ref of scope.references) {
    newOps.push(ir.createVariableOp(
        view.tpl.allocateXrefId(), ref.variable, new ir.ReferenceExpr(ref.targetId, ref.offset)));
  }

  if (scope.parent !== null) {
    // Recursively add variables from the parent scope.
    newOps.push(...generateVariablesInScopeForView<OpT>(view, scope.parent));
  }
  return newOps;
}
