/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Injectable, Injector, Provider, StaticProvider} from '../../di';
import {getInjectorDef} from '../../di/interface/defs';
import {createInjectorWithoutInjectorInstances, importProvidersFrom, R3Injector, walkProviderTree} from '../../di/r3_injector';
import {Type} from '../../interface/type';
import {OnDestroy} from '../../metadata';
import {stringify} from '../../util/stringify';
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
    if (!componentDef.standalone) {
      return null;
    }

    if (!this.cachedInjectors.has(componentDef)) {
      const providers = importProvidersFrom(componentDef.type);
      if (!providers.length) {
        return null;
      }

      // TODO: NgModuleRef?
      const standaloneInjector =
          new R3Injector(providers, this._injector, stringify(componentDef.type));
      this.cachedInjectors.set(componentDef, standaloneInjector);
      standaloneInjector.resolveInjectorInitializers();
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
    {dependencies}: {dependencies: TypeOrFactory<DependencyTypeList>}) {
  definition.dependencies = dependencies instanceof Function ? dependencies : () => dependencies;
  definition.getStandaloneInjector = (parentInjector: Injector) => {
    return parentInjector.get(StandaloneService).getOrCreateStandaloneInjector(definition);
  };
}
