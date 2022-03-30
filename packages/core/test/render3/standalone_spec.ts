/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {InjectionToken, ɵRenderFlags, ɵɵdefineComponent, ɵɵdefineInjector, ɵɵelement, ɵɵstandaloneProvidersFeature} from '../../src/core';
import {getComponentDef} from '../../src/render3/definition';

import {ComponentFixture, MockRendererFactory} from './render_util';

describe('standalone components, directives and pipes', () => {
  it('should filter out imported NgModules from a list of directives to match', () => {
    const token = new InjectionToken('TestToken');

    class TestModule {
      static ɵinj = ɵɵdefineInjector({providers: [{provide: token, useValue: 'From module'}]});
    }

    class TestComponent {
      static ɵfac = () => new TestComponent();
      static ɵcmp = ɵɵdefineComponent({
        type: TestComponent,
        selectors: [['test-cmp']],
        decls: 1,
        vars: 0,
        template:
            (rf: ɵRenderFlags, ctx: TestComponent) => {
              if (rf & ɵRenderFlags.Create) {
                ɵɵelement(0, 'div');
              }
            },
        dependencies: [TestModule],
        features: [ɵɵstandaloneProvidersFeature()],
        standalone: true
      });
    }

    const rendererFactory = new MockRendererFactory();
    const fixture = new ComponentFixture(TestComponent, {rendererFactory});

    // This test doesn't verify much for now but assures that we can import NgModule
    expect(fixture.html).toBe('<div></div>');

    const componentDef = getComponentDef(TestComponent);
    expect(componentDef?.ambientProviders().length).toBe(1);
  });
});