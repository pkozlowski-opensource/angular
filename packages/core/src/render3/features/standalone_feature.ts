/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Injectable, Injector, Provider, StaticProvider} from '../../di';
import {getInjectorDef} from '../../di/interface/defs';
import {createInjectorWithoutInjectorInstances, R3Injector} from '../../di/r3_injector';
import {OnDestroy} from '../../metadata';
import {ComponentDef, DependencyTypeList, TypeOrFactory} from '../interfaces/definition';

function nonNull<T>(value: T|null): value is T {
  return value !== null;
}

// TODO(pk): this is a POC, extract / unify this logic with R3Injector
function getAmbientProviders(dependencies: TypeOrFactory<DependencyTypeList>) {
  const moduleDeps = (typeof dependencies === 'function' ? dependencies() : dependencies)
                         .map(getInjectorDef)
                         .filter(nonNull);

  const providers = moduleDeps.reduce((soFar: Provider[], injectorDef) => {
    return [...soFar, ...injectorDef.providers];
  }, []);

  return providers as StaticProvider[];
}

// TODO(pk): document
@Injectable({providedIn: 'any'})
class StandaloneService implements OnDestroy {
  cachedInjectors = new Map<ComponentDef<unknown>, R3Injector>();

  constructor(private _injector: Injector) {}

  setInjector(componentDef: ComponentDef<unknown>, injector: R3Injector) {
    this.cachedInjectors.set(componentDef, injector);
  }

  getOrCreateStandaloneInjector(
      componentDef: ComponentDef<unknown>,
      dependencies: TypeOrFactory<DependencyTypeList>): Injector|null {
    if (componentDef.getStandaloneInjector === null) {
      return null;
    }

    if (!this.cachedInjectors.has(componentDef)) {
      const providers = getAmbientProviders(dependencies);
      if (providers.length) {
        const standaloneInjector =
            createInjectorWithoutInjectorInstances({name: ''}, this._injector, providers);
        this.cachedInjectors.set(componentDef, standaloneInjector);
      } else {
        return null;
      }
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
  definition.getStandaloneInjector = (parentInjector: Injector) => {
    return parentInjector.get(StandaloneService)
        .getOrCreateStandaloneInjector(definition, dependencies);
  };
}
