/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component, NgModule} from '@angular/core';
import {TestBed} from '@angular/core/testing';

describe('standalone components, directives and pipes', () => {
  it('should render a standalone component with dependenices and ambient providers', () => {
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
    class ModuleWithAProvider {
    }

    @Component({
      standalone: true,
      template: 'Outer<inner-cmp></inner-cmp>{{service.value}}',
      // TODO: this scenario (ModuleWithAProvider that doesn't contribute any directives / pipes to
      // the template) should be invalid and throw in JiT
      imports: [InnerCmp, ModuleWithAProvider],
    })
    class OuterCmp {
      constructor(readonly service: Service) {}
    }

    const fixture = TestBed.createComponent(OuterCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML).toEqual('Outer<inner-cmp>Inner</inner-cmp>Service');
  });

  describe('ambient providers', () => {
    it('should import and use NgModule with providers and components', () => {
      class Service {
        value = 'Service';
      }

      @Component({
        selector: 'needs-service',
        template: '{{service.value}}',
      })
      class NeedsServiceCmp {
        constructor(readonly service: Service) {}
      }

      @NgModule({
        providers: [Service],
        declarations: [NeedsServiceCmp],
        exports: [NeedsServiceCmp],
      })
      class LibModule {
      }

      @Component({
        standalone: true,
        imports: [LibModule],
        template: '<needs-service></needs-service>',
      })
      class TestCmp {
      }

      const fixture = TestBed.createComponent(TestCmp);
      fixture.detectChanges();
      expect(fixture.nativeElement.innerHTML).toEqual('<needs-service>Service</needs-service>');
    });

    it('should use transitivelly imported NgModule with providers and components', () => {
      class Service {
        value = 'Service';
      }

      @Component({
        selector: 'needs-service',
        template: '{{service.value}}',
      })
      class NeedsServiceCmp {
        constructor(readonly service: Service) {}
      }

      @NgModule({
        providers: [Service],
        declarations: [NeedsServiceCmp],
        exports: [NeedsServiceCmp],
      })
      class LibModule {
      }

      @Component({
        selector: 'inner',
        standalone: true,
        imports: [LibModule],
        template: '<needs-service></needs-service>',
      })
      class InnerCmp {
      }

      @Component({
        selector: 'inner',
        standalone: true,
        imports: [InnerCmp],
        template: '<inner></inner>',
      })
      class TestCmp {
      }

      const fixture = TestBed.createComponent(TestCmp);
      fixture.detectChanges();
      expect(fixture.nativeElement.innerHTML)
          .toEqual('<inner><needs-service>Service</needs-service></inner>');
    });
  });
});
