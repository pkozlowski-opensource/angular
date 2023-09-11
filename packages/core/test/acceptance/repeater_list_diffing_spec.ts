/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ɵsetEnabledBlockTypes as setEnabledBlockTypes} from '@angular/compiler/src/jit_compiler_facade';
import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';

describe('list differ', () => {
  beforeEach(() => setEnabledBlockTypes(['for']));
  afterEach(() => setEnabledBlockTypes([]));

  it('should swap rows', () => {
    @Component({
      template: `
        <ul>
            {#for (item of items); track item}
                <li>({{item}})</li>
            {/for}
        </ul>
      `,
    })
    class TestComponent {
      items = ['one', 'two', 'three'];
    }


    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();

    expect(fixture.elementRef.nativeElement.textContent).toBe('(one)(two)(three)')
  });
});
