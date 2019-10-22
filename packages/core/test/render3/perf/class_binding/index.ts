/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {ɵɵproperty} from '@angular/core/src/core';

import {ɵɵelementEnd, ɵɵelementStart} from '../../../../src/render3/instructions/element';
import {refreshView} from '../../../../src/render3/instructions/shared';
import {ɵɵclassMap} from '../../../../src/render3/instructions/styling';
import {RenderFlags} from '../../../../src/render3/interfaces/definition';
import {HOST, TVIEW} from '../../../../src/render3/interfaces/view';
import {createBenchmark} from '../micro_bench';
import {setupRootViewWithEmbeddedViews} from '../setup';

const CLASSES_1_A = 'one';
const CLASSES_1_B = CLASSES_1_A.toUpperCase();
const CLASSES_2_A = 'one two';
const CLASSES_2_B = CLASSES_2_A.toUpperCase();
const CLASSES_10_A = 'one two three four five six seven eight nine ten';
const CLASSES_10_B = CLASSES_10_A.toUpperCase();
let choseClasses = true;

`<ng-template>
  <div [class]=" choseClasses ? CLASSES_A: CLASSES_B ">
  </div>
</ng-template>`;
function test1Template(rf: RenderFlags, ctx: any) {
  if (rf & 1) {
    ɵɵelementStart(0, 'div');
    ɵɵelementEnd();
  }
  if (rf & 2) {
    ɵɵclassMap(choseClasses ? CLASSES_1_A : CLASSES_1_B);
  }
}

function test2Template(rf: RenderFlags, ctx: any) {
  if (rf & 1) {
    ɵɵelementStart(0, 'div');
    ɵɵelementEnd();
  }
  if (rf & 2) {
    ɵɵclassMap(choseClasses ? CLASSES_2_A : CLASSES_2_B);
  }
}

function test10Template(rf: RenderFlags, ctx: any) {
  if (rf & 1) {
    ɵɵelementStart(0, 'div');
    ɵɵelementEnd();
  }
  if (rf & 2) {
    ɵɵclassMap(choseClasses ? CLASSES_10_A : CLASSES_10_B);
  }
}

function testDirectTemplate(rf: RenderFlags, ctx: any) {
  if (rf & 1) {
    ɵɵelementStart(0, 'div');
    ɵɵelementEnd();
  }
  if (rf & 2) {
    ɵɵproperty('className', choseClasses ? CLASSES_10_A : CLASSES_10_B);
  }
}


const root1LView = setupRootViewWithEmbeddedViews(test1Template, 1, 1, 1000);
const root1TView = root1LView[TVIEW];
const root2LView = setupRootViewWithEmbeddedViews(test2Template, 1, 1, 1000);
const root2TView = root2LView[TVIEW];
const root10LView = setupRootViewWithEmbeddedViews(test10Template, 1, 1, 1000);
const root10TView = root10LView[TVIEW];
const rootDirectLView = setupRootViewWithEmbeddedViews(testDirectTemplate, 1, 1, 1000);
const rootDirectTView = rootDirectLView[TVIEW];

// scenario to benchmark
const classBindingBenchmark = createBenchmark('class binding');
const class1Map = classBindingBenchmark('classMap1');
const class2Map = classBindingBenchmark('classMap2');
const class10Map = classBindingBenchmark('classMap10');
const classMapDirect = classBindingBenchmark('classMapDirect');

// run change detection in the update mode
console.profile('class_map_1');
while (class1Map()) {
  choseClasses = !choseClasses;
  refreshView(root1LView, root1TView, null, null);
}
console.profileEnd();

console.profile('class_map_2');
while (class2Map()) {
  choseClasses = !choseClasses;
  refreshView(root2LView, root2TView, null, null);
}
console.profileEnd();

console.profile('class_map_10');
while (class10Map()) {
  choseClasses = !choseClasses;
  refreshView(root10LView, root10TView, null, null);
}
console.profileEnd();

console.profile('class_map_direct');
while (classMapDirect()) {
  choseClasses = !choseClasses;
  refreshView(rootDirectLView, rootDirectTView, null, null);
}
console.profileEnd();

// report results
classBindingBenchmark.report();

const isBrowser = typeof process === 'undefined';
if (isBrowser) {
  refreshView(root1LView, root1TView, null, null);
  const element = root1LView[HOST] as HTMLElement;
  debugger;
  // I would like to verify that the correct DOM was built but this does not seem to be working???
  console.log(element.outerHTML);
}
