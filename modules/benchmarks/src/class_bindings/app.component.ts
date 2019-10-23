/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Component} from '@angular/core';

@Component({
  selector: 'app-component',
  template: `
    <button (click)="ref.update()">Update</button>
    <class-bindings #ref><class-bindings>
  `
})
export class AppComponent {
}