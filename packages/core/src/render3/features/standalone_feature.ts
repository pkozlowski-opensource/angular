/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Injectable, Injector, Provider, StaticProvider} from '../../di';
import {getInjectorDef} from '../../di/interface/defs';
import {OnDestroy} from '../../metadata';
import {ComponentDef, DependencyTypeList, TypeOrFactory} from '../interfaces/definition';

// TODO(pk): code duplication
function nonNull<T>(value: T|null): value is T {
  return value !== null;
}

@Injectable({providedIn: 'any'})
class StandaloneService implements OnDestroy {
  // Question: shell we cache injectors of collected providers?
  cachedInjectors = new Map<ComponentDef<unknown>, Injector>();

  constructor(private _injector: Injector) {}

  getOrCreateStandaloneInjector(componentDef: ComponentDef<unknown>) {
    if (!this.cachedInjectors.has(componentDef)) {
      const providers =
          componentDef.getAmbientProviders !== null ? componentDef.getAmbientProviders() : [];
      if (providers.length) {
        const standaloneInjector = Injector.create({providers: providers, parent: this._injector});
        this.cachedInjectors.set(componentDef, standaloneInjector);
      } else {
        // Question: maybe we should we systematically create a standalone injector?
        this.cachedInjectors.set(componentDef, this._injector);
      }
    }

    return this.cachedInjectors.get(componentDef)!;
  }

  ngOnDestroy() {
    // Question: do we need to do this manually? In other words: are child injectors destroyed when
    // a parent injector is destroyed? Probably not since not every injector is "destroyable"?
    try {
      for (const injector of this.cachedInjectors.values()) {
        if (injector !== this._injector) {
          // injector.destroy()
        }
      }
    } finally {
      // Question: a map should be cleared when this objects gets destroyed, right? But at the same
      // time this map might reference this very injector? In any case clearing wouldn't hurt...
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
  let resolvedProviders: StaticProvider[]|undefined = undefined;
  definition.getAmbientProviders = () => {
    // TODO(pk): quick and dirty POC to get providers from modules; it needs significently more
    // work:
    // - descent into imports of NgModule(s)
    // - take into account standalone coponents + descent into

    // Question: this logic will be somehow duplicated with what R3Injector does - can we refactor
    // / reuse?

    if (resolvedProviders === undefined) {
      const moduleDeps = (typeof dependencies === 'function' ? dependencies() : dependencies)
                             .map(getInjectorDef)
                             .filter(nonNull);

      const providers = moduleDeps.reduce((soFar: Provider[], injectorDef) => {
        return [...soFar, ...injectorDef.providers];
      }, []);

      resolvedProviders = providers as StaticProvider[];
    }

    return resolvedProviders;
  };

  definition.getStandaloneInjector = (parentInjector: Injector) => {
    return parentInjector.get(StandaloneService).getOrCreateStandaloneInjector(definition);
  };
}
