/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {validateAgainstEventProperties} from '../../sanitization/sanitization';
import {computed, SIGNAL} from '../../signals';
import {assertDefined, assertIndexInRange} from '../../util/assert';
import {EMPTY_ARRAY} from '../../util/empty';
import {bindingUpdated} from '../bindings';
import {DirectiveDef} from '../interfaces/definition';
import {PropertyAliasValue, TNode} from '../interfaces/node';
import {InternalInputSignal} from '../interfaces/reactivity';
import {RComment, RElement} from '../interfaces/renderer_dom';
import {SanitizerFn} from '../interfaces/sanitization';
import {isComponentHost} from '../interfaces/type_checks';
import {HEADER_OFFSET, RENDERER} from '../interfaces/view';
import {getCurrentTNode, getLView, getSelectedTNode, getTView, nextBindingIndex} from '../state';
import {getNativeByTNode} from '../util/view_utils';

import {handleUnknownPropertyError, isPropertyValid} from './element_validation';
import {mapPropName, markDirtyIfOnPush, setNgReflectProperties, writeToDirectiveInput} from './shared';

/**
 * TODO
 *
 * @codeGenApi
 */
export function ɵɵpropertyCreate<T>(
    slot: number, propName: string, expr: () => T,
    sanitizer?: SanitizerFn|null): typeof ɵɵpropertyCreate {
  const lView = getLView();
  const expressionSlot = HEADER_OFFSET + slot;

  const tView = getTView();
  const tNode = getCurrentTNode();
  assertDefined(tNode, `propertyCreate() must follow an actual element`);

  const inputData = tNode.inputs?.[propName] ?? EMPTY_ARRAY;

  let signalInputs: InternalInputSignal[]|null = null;

  // PERF: the fact that we need to iterate over all the inputs here isn't great.
  // We might consider storing more info on TView
  let zoneTargets: PropertyAliasValue|null = null;
  for (let i = 0; i < inputData.length;) {
    const directiveIndex = inputData[i++] as number;
    const privateName = inputData[i++] as string;
    const def = tView.data[directiveIndex] as DirectiveDef<any>;
    if (!def.signals) {
      // TODO(pk): refactor - code flow with all those firstCreatePass checks becomes hard to follow
      if (tView.firstCreatePass) {
        (zoneTargets ??= []).push(directiveIndex, privateName);
      }
    } else {
      ngDevMode && assertIndexInRange(lView, directiveIndex);
      // PERF: megamorphic read on [privateName] access
      const inputSignal = lView[directiveIndex][privateName][SIGNAL] as InternalInputSignal;
      (signalInputs ??= []).push(inputSignal);
    }
  }

  zoneTargets ??= EMPTY_ARRAY;
  signalInputs ??= EMPTY_ARRAY;

  // If there are multiple signal targets, or any zone targets, then wrap `expr` in a computed. This
  // ensures that the expression is only evaluated once, even if it has multiple consumers. Zone
  // targets always use a computed as this memoizes all object/literal creation (which would
  // otherwise have used pure functions).
  if (zoneTargets.length > 0 || signalInputs.length > 1) {
    expr = computed(expr);
  }

  lView[expressionSlot] = expr;
  for (const inputSignal of signalInputs) {
    inputSignal.bindToComputation(expr);
  }

  if (tView.firstCreatePass) {
    if (inputData.length === 0) {
      // Untargeted input -> DOM binding.
      (tView.virtualUpdate ??= []).push({
        slot: expressionSlot,
        instruction: () =>
            propertyUpdateDom(tNode.index, propName, expressionSlot, sanitizer ?? null),
      });
    } else if (zoneTargets?.length ?? 0 > 0) {
      // Some binding targets were zone-based, so we need an update instruction to process them.
      (tView.virtualUpdate ??= []).push({
        slot: expressionSlot,
        instruction: () => propertyUpdateInput(propName, expressionSlot, zoneTargets!),
      });
    } else {
      // The only target(s) were signal-based, so no update path is needed.
    }
  }

  return ɵɵpropertyCreate;
}

export function propertyUpdateDom(
    nodeSlot: number, propName: string, expressionSlot: number, sanitizer: SanitizerFn|null): void {
  const lView = getLView();
  const expr = lView[expressionSlot];

  let value = expr();
  const bindingIndex = nextBindingIndex();
  if (!bindingUpdated(lView, bindingIndex, value)) {
    return;
  }

  const tView = getTView();
  const tNode = tView.data[nodeSlot] as TNode;
  const element = getNativeByTNode(tNode, lView) as RElement | RComment;

  propName = mapPropName(propName);

  if (ngDevMode) {
    validateAgainstEventProperties(propName);
    if (!isPropertyValid(element, propName, tNode.value, tView.schemas)) {
      handleUnknownPropertyError(propName, tNode.value, tNode.type, lView);
    }
    ngDevMode.rendererSetProperty++;
  }

  // It is assumed that the sanitizer is only added when the compiler determines that the
  // property is risky, so sanitization can be done without further checks.
  value = sanitizer != null ? (sanitizer(value, tNode.value || '', propName) as any) : value;
  lView[RENDERER].setProperty(element as RElement, propName, value);
}

export function propertyUpdateInput(
    propName: string, expressionSlot: number, targets: PropertyAliasValue): void {
  const lView = getLView();
  const expr = lView[expressionSlot];
  const value = expr();

  const tNode = getSelectedTNode();
  const tView = getTView();

  ngDevMode && assertDefined(tNode.inputs, `Expected tNode to have inputs`);

  const bindingIndex = nextBindingIndex();
  if (!bindingUpdated(lView, bindingIndex, value)) {
    return;
  }

  for (let i = 0; i < targets.length;) {
    const index = targets[i++] as number;
    const privateName = targets[i++] as string;
    ngDevMode && assertIndexInRange(lView, index);
    const instance = lView[index];
    const def = tView.data[index] as DirectiveDef<any>;

    writeToDirectiveInput(def, instance, propName, privateName, value);
  }

  const element = getNativeByTNode(tNode, lView) as RElement | RComment;
  if (isComponentHost(tNode)) {
    markDirtyIfOnPush(lView, tNode.index);
  }
  if (ngDevMode) {
    setNgReflectProperties(lView, element, tNode.type, targets, value);
  }
}
