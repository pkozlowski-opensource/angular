/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component, NgModule} from '@angular/core';
import {TestBed} from '@angular/core/testing';

describe('standalone stuff', () => {
  fit('should not suck', () => {
    @Component({
      standalone: true,
      template: 'Inner',
      selector: 'inner-cmp',
    })
    class InnerCmp {
    }

    class Service {
      value = 'Service';
    }

    @NgModule({providers: [Service]})
    class Module {
    }

    @Component({
      standalone: true,
      template: 'Outer<inner-cmp></inner-cmp>{{service.value}}',
      imports: [InnerCmp, Module],
    })
    class OuterCmp {
      constructor(readonly service: Service) {}
    }

    const fixture = TestBed.createComponent(OuterCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML).toEqual('Outer<inner-cmp>Inner</inner-cmp>Service');
  });
});
