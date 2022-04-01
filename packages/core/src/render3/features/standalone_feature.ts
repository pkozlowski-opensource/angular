/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Type} from '../../core';
import {Injectable, Injector} from '../../di';
import {InjectorType, NG_INJ_DEF} from '../../di/interface/defs';
import {R3Injector} from '../../di/r3_injector';
import {OnDestroy} from '../../metadata';
import {ComponentDef, DependencyTypeList, TypeOrFactory} from '../interfaces/definition';


// TODO(pk): document
@Injectable({providedIn: 'any'})
class StandaloneService implements OnDestroy {
  cachedInjectors = new Map<ComponentDef<unknown>, R3Injector>();

  constructor(private _injector: Injector) {}

  setInjector(componentDef: ComponentDef<unknown>, injector: R3Injector) {
    this.cachedInjectors.set(componentDef, injector);
  }

  getOrCreateStandaloneInjector(componentDef: ComponentDef<unknown>): Injector|null {
    if (componentDef.getStandaloneInjector === null) {
      return null;
    }

    if (!this.cachedInjectors.has(componentDef)) {
      this.cachedInjectors.set(
          componentDef,
          new R3Injector(componentDef.type as InjectorType<unknown>, null, this._injector));
    }

    return this.cachedInjectors.get(componentDef)!;
  }

  ngOnDestroy() {
    try {
      for (const injector of this.cachedInjectors.values()) {
        if (injector !== this._injector) {
          injector.destroy();
        }
      }
    } finally {
      this.cachedInjectors.clear();
    }
  }
}

/**
 * TODO(pk): documentation
 *
 * @codeGenApi
 */
export function ɵɵStandaloneFeature(
    definition: ComponentDef<unknown>,
    {dependencies}: {dependencies: TypeOrFactory<DependencyTypeList>|undefined}) {
  if (dependencies !== undefined) {
    const componentType = definition.type;

    const imports = (typeof dependencies === 'function' ? dependencies() : dependencies)
                        .filter((type: Type<any>) => type.hasOwnProperty(NG_INJ_DEF));

    if (imports.length) {
      // TODO(pk): forwardRef to NgModule????
      // patch the standalone component type so it "looks like" InjectorDef if needed
      (componentType as any)[NG_INJ_DEF] = {providers: [], imports: imports};

      // make sure that a standalone injector can be created based on this componet def
      definition.getStandaloneInjector = (parentInjector: Injector) => {
        return parentInjector.get(StandaloneService).getOrCreateStandaloneInjector(definition);
      };
    }
  }
}
