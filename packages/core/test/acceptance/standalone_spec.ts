/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CommonModule} from '@angular/common';
import {Component, Directive, forwardRef, Input, NgModule, Pipe, PipeTransform} from '@angular/core';
import {TestBed} from '@angular/core/testing';

describe('standalone components, directives and pipes', () => {
  it('should render a standalone component', () => {
    @Component({
      standalone: true,
      template: 'Look at me, no NgModule!',
    })
    class StandaloneCmp {
    }

    const fixture = TestBed.createComponent(StandaloneCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML).toEqual('Look at me, no NgModule!');
  });

  it('should render a recursive standalone component', () => {
    @Component({
      selector: 'tree',
      standalone: true,
      template:
          `({{level}})<ng-template [ngIf]="level > 0"><tree [level]="level - 1"></tree></ng-template>`,
      imports: [CommonModule]
    })
    class TreeCmp {
      @Input() level = 0;
    }

    @Component({standalone: true, template: '<tree [level]="3"></tree>', imports: [TreeCmp]})
    class StandaloneCmp {
    }

    const fixture = TestBed.createComponent(StandaloneCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('(3)(2)(1)(0)');
  });

  it('should render a standalone component with a standalone dependency', () => {
    @Component({
      standalone: true,
      selector: 'inner-cmp',
      template: 'Look at me, no NgModule!',
    })
    class InnerCmp {
    }

    @Component({
      standalone: true,
      template: '<inner-cmp></inner-cmp>',
      imports: [InnerCmp],
    })
    class StandaloneCmp {
    }

    const fixture = TestBed.createComponent(StandaloneCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML)
        .toEqual('<inner-cmp>Look at me, no NgModule!</inner-cmp>');
  });


  it('should render a standalone component with an NgModule-based dependency', () => {
    @Component({
      selector: 'inner-cmp',
      template: 'Look at me, no NgModule (kinda)!',
    })
    class InnerCmp {
    }

    @NgModule({
      declarations: [InnerCmp],
      exports: [InnerCmp],
    })
    class Module {
    }

    @Component({
      standalone: true,
      template: '<inner-cmp></inner-cmp>',
      imports: [Module],
    })
    class StandaloneCmp {
    }

    const fixture = TestBed.createComponent(StandaloneCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML)
        .toEqual('<inner-cmp>Look at me, no NgModule (kinda)!</inner-cmp>');
  });

  it('should allow exporting standalone components, directives and pipes from NgModule', () => {
    @Component({
      selector: 'standalone-cmp',
      standalone: true,
      template: `standalone`,
    })
    class StandaloneCmp {
    }

    @Directive({
      selector: '[standalone-dir]',
      host: {
        '[attr.id]': '"standalone"',
      },
      standalone: true
    })
    class StandaloneDir {
    }

    @Pipe({name: 'standalonePipe', standalone: true})
    class StandalonePipe implements PipeTransform {
      transform(value: any) {
        return `|${value}`;
      }
    }

    @NgModule({
      imports: [StandaloneCmp, StandaloneDir, StandalonePipe],
      exports: [StandaloneCmp, StandaloneDir, StandalonePipe],
    })
    class LibModule {
    }

    @Component({
      selector: 'app-cmpt',
      template: `<standalone-cmp standalone-dir></standalone-cmp>{{'standalone' | standalonePipe}}`,
    })
    class AppComponent {
    }

    TestBed.configureTestingModule({
      imports: [LibModule],
      declarations: [AppComponent],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toBe('standalone|standalone');
    expect(fixture.nativeElement.querySelector('standalone-cmp').getAttribute('id'))
        .toBe('standalone');
  });


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
      imports: [InnerCmp, ModuleWithAProvider],
    })
    class OuterCmp {
      constructor(readonly service: Service) {}
    }

    const fixture = TestBed.createComponent(OuterCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML).toEqual('Outer<inner-cmp>Inner</inner-cmp>Service');
  });

  it('should discover ambient providers from a standalone component', () => {
    class Service {
      value = 'Service';
    }

    @NgModule({providers: [Service]})
    class ModuleWithAProvider {
    }

    @Component({
      standalone: true,
      template: 'Inner({{service.value}})',
      selector: 'inner-cmp',
      imports: [ModuleWithAProvider],
    })
    class InnerCmp {
      constructor(readonly service: Service) {}
    }

    @Component({
      standalone: true,
      template: 'Outer<inner-cmp></inner-cmp>{{service.value}}',
      imports: [InnerCmp],
    })
    class OuterCmp {
      constructor(readonly service: Service) {}
    }

    const fixture = TestBed.createComponent(OuterCmp);
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML)
        .toEqual('Outer<inner-cmp>Inner(Service)</inner-cmp>Service');
  });

  it('should collect ambient providers from exported NgModule', () => {
    class Service {
      value = 'service';
    }

    @NgModule({providers: [Service]})
    class ModuleWithAService {
    }

    @NgModule({exports: [ModuleWithAService]})
    class ExportingModule {
    }

    @Component({
      selector: 'standalone',
      standalone: true,
      imports: [ExportingModule],
      template: `({{service.value}})`
    })
    class TestComponent {
      constructor(readonly service: Service) {}
    }

    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('(service)');
  });

  it('should support forwardRef imports', () => {
    @Component({
      selector: 'test',
      standalone: true,
      imports: [forwardRef(() => StandaloneComponent)],
      template: `(<other-standalone></other-standalone>)`
    })
    class TestComponent {
    }

    @Component({selector: 'other-standalone', standalone: true, template: `standalone component`})
    class StandaloneComponent {
    }

    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('(standalone component)');
  });

  it('should error when forwardRef does not resolve to a truthy value', () => {
    @Component({
      selector: 'test',
      standalone: true,
      imports: [forwardRef(() => null)],
      template: '',
    })
    class TestComponent {
    }
    expect(() => {
      TestBed.createComponent(TestComponent);
    })
        .toThrowError(
            'Expected forwardRef function, imported from "TestComponent", to return a standalone entity or NgModule but got "null".');
  });

  it('should error when a non-standalone component is imported', () => {
    @Component({
      selector: 'not-a-standalone',
      template: '',
    })
    class NonStandaloneCmp {
    }

    @Component({
      selector: 'standalone',
      standalone: true,
      template: '',
      imports: [NonStandaloneCmp],
    })
    class StandaloneCmp {
    }

    expect(() => {
      TestBed.createComponent(StandaloneCmp);
    })
        .toThrowError(
            'The "NonStandaloneCmp" component, imported from "StandaloneCmp", is not standalone. Did you forget to add the standalone: true flag?');
  });

  it('should error when a non-standalone directive is imported', () => {
    @Directive({selector: '[not-a-standalone]'})
    class NonStandaloneDirective {
    }

    @Component({
      selector: 'standalone',
      standalone: true,
      template: '',
      imports: [NonStandaloneDirective],
    })
    class StandaloneCmp {
    }

    expect(() => {
      TestBed.createComponent(StandaloneCmp);
    })
        .toThrowError(
            'The "NonStandaloneDirective" directive, imported from "StandaloneCmp", is not standalone. Did you forget to add the standalone: true flag?');
  });

  it('should error when a non-standalone pipe is imported', () => {
    @Pipe({name: 'not-a-standalone'})
    class NonStandalonePipe {
    }

    @Component({
      selector: 'standalone',
      standalone: true,
      template: '',
      imports: [NonStandalonePipe],
    })
    class StandaloneCmp {
    }

    expect(() => {
      TestBed.createComponent(StandaloneCmp);
    })
        .toThrowError(
            'The "NonStandalonePipe" pipe, imported from "StandaloneCmp", is not standalone. Did you forget to add the standalone: true flag?');
  });

  it('should error when an unknown type is imported', () => {
    class SthElse {}

    @Component({
      selector: 'standalone',
      standalone: true,
      template: '',
      imports: [SthElse],
    })
    class StandaloneCmp {
    }

    expect(() => {
      TestBed.createComponent(StandaloneCmp);
    })
        .toThrowError(
            'The "SthElse" type, imported from "StandaloneCmp", must be a standalone component / directive / pipe or a NgModule. Did you forget to add the required @Component / @Directive / @Pipe or @NgModule annotation?');
  });

  it('should error when a module with providers is imported', () => {
    @NgModule()
    class OtherModule {
    }

    @NgModule()
    class LibModule {
      static forComponent() {
        return {ngModule: OtherModule};
      }
    }

    @Component({
      standalone: true,
      template: '',
      // we need to import a module with a provider in a nested array since module with providers
      // are disallowed on the type level
      imports: [[LibModule.forComponent()]],
    })
    class StandaloneCmp {
    }

    expect(() => {
      TestBed.createComponent(StandaloneCmp);
    })
        .toThrowError(
            'A module with providers was imported from "StandaloneCmp". Modules with providers are not supported in stnadalone components imports.');
  });
});
