/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {EnvInjector} from '../../di';
import {inject} from '../../di/injector_compatibility';
import {ɵɵdefineInjectable as defineInjectable} from '../../di/interface/defs';
import {importProvidersFrom} from '../../di/r3_injector';
import {OnDestroy} from '../../metadata';
import {stringify} from '../../util/stringify';
import {ComponentDef, DependencyTypeList, TypeOrFactory} from '../interfaces/definition';
import {createEnvInjector} from '../ng_module_ref';

/**
 * A service used by the framework to create instances of standalone injectors. Those injectors are
 * created on demand in case of dynamic component instantiation and contain ambient providers
 * collected from the imports graph rooted at a given standalone component.
 */
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
 * A feature that acts as a setup code for the {@see StandaloneService}.
 *
 * The most important responsaibility of this feature is to expose the "getStandaloneInjector"
 * function (an entry points to a standalone injector creation) on a component definition object. We
 * go through the features infrastructure to make sure that the standalone injector creation logic
 * is tree-shakable and not included in applications that don't use standalone components.
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
