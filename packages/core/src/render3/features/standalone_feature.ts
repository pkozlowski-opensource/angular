/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {EnvInjector, Injectable, Provider, StaticProvider} from '../../di';
import {inject} from '../../di/injector_compatibility';
import {ɵɵdefineInjectable as defineInjectable} from '../../di/interface/defs';
import {createInjectorWithoutInjectorInstances, importProvidersFrom, R3Injector, walkProviderTree} from '../../di/r3_injector';
import {Type} from '../../interface/type';
import {OnDestroy} from '../../metadata';
import {stringify} from '../../util/stringify';
import {ComponentDef, DependencyTypeList, TypeOrFactory} from '../interfaces/definition';
import {createEnvInjector} from '../ng_module_ref';

// TODO(pk): document
export class StandaloneService implements OnDestroy {
  cachedInjectors = new Map<ComponentDef<unknown>, EnvInjector>();

  constructor(private _injector: EnvInjector) {}

  setInjector(componentDef: ComponentDef<unknown>, injector: EnvInjector) {
    this.cachedInjectors.set(componentDef, injector);
  }

  getOrCreateStandaloneInjector(componentDef: ComponentDef<unknown>): EnvInjector|null {
    if (!componentDef.standalone) {
      return null;
    }

    if (!this.cachedInjectors.has(componentDef)) {
      const providers = importProvidersFrom(componentDef.type);
      if (!providers.length) {
        return null;
      }

      const standaloneInjector =
          createEnvInjector(providers, this._injector, stringify(componentDef.type));
      this.cachedInjectors.set(componentDef, standaloneInjector);
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

  static ɵprov = /** @pureOrBreakMyCode */ defineInjectable({
    token: StandaloneService,
    providedIn: 'env',
    factory: () => new StandaloneService(inject(EnvInjector)),
  });
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
  definition.getStandaloneInjector = (parentInjector: EnvInjector) => {
    return parentInjector.get(StandaloneService).getOrCreateStandaloneInjector(definition);
  };
}
