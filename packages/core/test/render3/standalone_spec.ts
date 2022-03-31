/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {InjectionToken, Injector, ɵRenderFlags, ɵɵdefineComponent, ɵɵdefineInjector, ɵɵelement, ɵɵStandaloneFeature} from '../../src/core';
import {getComponentDef} from '../../src/render3/definition';

import {ComponentFixture, MockRendererFactory} from './render_util';

describe('standalone components, directives and pipes', () => {
  it('should filter out imported NgModules from a list of directives to match', () => {
    const token = new InjectionToken<String>('TestToken');

    let count = 0;
    class TestModule {
      static ɵinj = ɵɵdefineInjector({
        providers: [{
          provide: token,
          useFactory:
              () => {
                return `From module: ${count++}`;
              }
        }]
      });
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
        features: [ɵɵStandaloneFeature],
        standalone: true
      });
    }

    const rendererFactory = new MockRendererFactory();
    const fixture = new ComponentFixture(TestComponent, {rendererFactory});

    // This test doesn't verify much for now but assures that we can import NgModule
    expect(fixture.html).toBe('<div></div>');

    const componentDef = getComponentDef(TestComponent);

    // TODO: how to exercise what I'm trying to do?
    // roughly, ComponentFactory.create will do the following:
    const parentInjector = Injector.create({providers: []});
    const def = getComponentDef(TestComponent);

    if (def !== null && def.getStandaloneInjector !== null) {
      expect(def.getStandaloneInjector(parentInjector).get(token)).toEqual('From module: 0');

      // subsequent calls with the same same parent injector should not create new provider
      // instances
      expect(def.getStandaloneInjector(parentInjector).get(token)).toEqual('From module: 0');

      // but specifying a different injector _should_ create a new provider instance
      const otherParentInjector = Injector.create({providers: []});
      expect(def.getStandaloneInjector(otherParentInjector).get(token)).toEqual('From module: 1');

      // again, same calls should not create new instances
      expect(def.getStandaloneInjector(parentInjector).get(token)).toEqual('From module: 0');
      expect(def.getStandaloneInjector(otherParentInjector).get(token)).toEqual('From module: 1');
    } else {
      fail('Failed to get component def or standalone feature function');
    }
  });
});
