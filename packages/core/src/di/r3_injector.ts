/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import '../util/ng_dev_mode';

import {RuntimeError, RuntimeErrorCode} from '../errors';
import {OnDestroy} from '../interface/lifecycle_hooks';
import {Type} from '../interface/type';
import {getComponentDef} from '../render3/definition';
import {FactoryFn, getFactoryDef} from '../render3/definition_factory';
import {throwCyclicDependencyError, throwInvalidProviderError, throwMixedMultiProviderError} from '../render3/errors_di';
import {deepForEach, flatten, newArray} from '../util/array_utils';
import {EMPTY_ARRAY} from '../util/empty';
import {stringify} from '../util/stringify';

import {resolveForwardRef} from './forward_ref';
import {setInjectImplementation} from './inject_switch';
import {InjectionToken} from './injection_token';
import {Injector} from './injector';
import {catchInjectorError, inject, injectArgs, NG_TEMP_TOKEN_PATH, setCurrentInjector, THROW_IF_NOT_FOUND, USE_VALUE, ɵɵinject} from './injector_compatibility';
import {INJECTOR} from './injector_token';
import {getInheritedInjectableDef, getInjectableDef, getInjectorDef, InjectorType, InjectorTypeWithProviders, ɵɵInjectableDeclaration} from './interface/defs';
import {InjectFlags} from './interface/injector';
import {ClassProvider, ConstructorProvider, ExistingProvider, FactoryProvider, StaticClassProvider, StaticProvider, TypeProvider, ValueProvider} from './interface/provider';
import {NullInjector} from './null_injector';
import {ProviderToken} from './provider_token';
import {INJECTOR_SCOPE} from './scope';



/**
 * Internal type for a single provider in a deep provider array.
 */
type SingleProvider = TypeProvider|ValueProvider|ClassProvider|ConstructorProvider|ExistingProvider|
    FactoryProvider|StaticClassProvider;

/**
 * Marker which indicates that a value has not yet been created from the factory function.
 */
const NOT_YET = {};

/**
 * Marker which indicates that the factory function for a token is in the process of being called.
 *
 * If the injector is asked to inject a token with its value set to CIRCULAR, that indicates
 * injection of a dependency has recursively attempted to inject the original token, and there is
 * a circular dependency among the providers.
 */
const CIRCULAR = {};

/**
 * Special token that allows attaching a custom logic that would be invoked once an injector is
 * created by the framework.
 */
// TODO: make it a public API
export const INJECTOR_INITIALIZER = new InjectionToken<() => void>('INJECTOR_INITIALIZER');

/**
 * Internal-only multi-provider token to collect all Injector def types (NgModules and
 * Standalone Components) that were collected while walking the injector def tree.
 */
const INJECTOR_DEF_TYPES = new InjectionToken<Type<unknown>>('INJECTOR_DEF_TYPES');

/**
 * A lazily initialized NullInjector.
 */
let NULL_INJECTOR: Injector|undefined = undefined;

function getNullInjector(): Injector {
  if (NULL_INJECTOR === undefined) {
    NULL_INJECTOR = new NullInjector();
  }
  return NULL_INJECTOR;
}

/**
 * An entry in the injector which tracks information about the given token, including a possible
 * current value.
 */
interface Record<T> {
  factory: (() => T)|undefined;
  value: T|{};
  multi: any[]|undefined;
}

/**
 * Create a new `Injector` which is configured using a `defType` of `InjectorType<any>`s.
 *
 * @publicApi
 */
export function createInjector(
    defType: /* InjectorType<any> */ any, parent: Injector|null = null,
    additionalProviders: StaticProvider[]|null = null, name?: string): Injector {
  const injector =
      createInjectorWithoutInjectorInstances(defType, parent, additionalProviders, name);
  injector.resolveInjectorInitializers();
  return injector;
}

/**
 * Creates a new injector without eagerly resolving its injector types. Can be used in places
 * where resolving the injector types immediately can lead to an infinite loop. The injector types
 * should be resolved at a later point by calling `_resolveInjectorDefTypes`.
 */
export function createInjectorWithoutInjectorInstances(
    defType: /* InjectorType<any> */ any, parent: Injector|null = null,
    additionalProviders: StaticProvider[]|null = null, name?: string): R3Injector {
  const providers = importProvidersFrom(defType);
  if (additionalProviders) {
    providers.push(...flatten(additionalProviders));
  }
  name = name || (typeof defType === 'object' ? undefined : stringify(defType));

  return new R3Injector(providers, parent || getNullInjector(), name);
}

/**
 * The logic visits an `InjectorType` or `InjectorTypeWithProviders` and all of its transitive
 * providers and collects all encountered providers (appends them to the `providersOut` array).
 *
 * If an `InjectorTypeWithProviders` that declares providers besides the type is specified,
 * the function will return "true" to indicate that the providers of the type definition need
 * to be processed. This allows us to process providers of injector types after all imports of
 * an injector definition are processed. (following View Engine semantics: see FW-1349)
 */
export function walkProviderTree(
    container: Type<unknown>|InjectorTypeWithProviders<unknown>, providersOut: SingleProvider[],
    parents: Type<unknown>[],
    dedup: Set<Type<unknown>>): container is InjectorTypeWithProviders<unknown> {
  container = resolveForwardRef(container);
  if (!container) return false;

  // Either the defOrWrappedDef is an InjectorType (with injector def) or an
  // InjectorDefTypeWithProviders (aka ModuleWithProviders). Detecting either is a megamorphic
  // read, so care is taken to only do the read once.

  // First attempt to read the injector def (`ɵinj`).
  let ngModuleDef = getInjectorDef(container);

  // If no NgModule definition is found, look for a standalone component definition.
  const cmpDef = ngModuleDef ? null : getComponentDef(container);

  // If that's not present, then attempt to read ngModule from the InjectorDefTypeWithProviders.
  const ngModule = (ngModuleDef == null && cmpDef == null) &&
          (container as InjectorTypeWithProviders<any>).ngModule ||
      undefined;

  // If `container` is an NgModule or a ModuleWithProviders, this is its type.
  let ngModuleType: InjectorType<any>|null = null;
  if (!cmpDef) {
    // Determine the InjectorType. In the case where `defOrWrappedDef` is an `InjectorType`,
    // then this is easy. In the case of an InjectorDefTypeWithProviders, then the definition type
    // is the `ngModule`.
    ngModuleType = (ngModule === undefined) ? (container as InjectorType<any>) : ngModule;
  }

  // Either the type is an NgModule or a standalone component.
  let type: Type<unknown> = ngModuleType || (container as Type<unknown>);

  // Check for circular dependencies.
  if (ngDevMode && type !== null && parents.indexOf(type) !== -1) {
    const defName = stringify(type);
    const path = parents.map(stringify);
    throwCyclicDependencyError(defName, path);
  }

  // Check for multiple imports of the same module/component.
  const isDuplicate = dedup.has(type);

  // Finally, if defOrWrappedType was an `InjectorDefTypeWithProviders`, then the actual
  // `InjectorDef` is on its `ngModule`.
  if (ngModule !== undefined) {
    ngModuleDef = getInjectorDef(ngModule);
  }

  // If no NoNgModule definition was found, it might be from exports or from a standalone component.
  // Remove it.
  // TODO(pk): adjust the above comment
  if (ngModuleDef == null && (cmpDef == null || !cmpDef.standalone)) {
    return false;
  }

  // Add providers in the same way that @NgModule resolution did:

  const imports =
      ngModuleDef !== null ? ngModuleDef.imports : (cmpDef!.dependencies?.() || EMPTY_ARRAY);

  // First, include providers from any imports.
  if (imports != null && !isDuplicate) {
    // Before processing defType's imports, add it to the set of parents. This way, if it ends
    // up deeply importing itself, this can be detected.
    ngDevMode && parents.push(type);
    // Add it to the set of dedups. This way we can detect multiple imports of the same module
    dedup.add(type);

    let importTypesWithProviders: (InjectorTypeWithProviders<any>[])|undefined;
    try {
      deepForEach(imports as (any[] | Type<unknown>)[], imported => {
        if (walkProviderTree(imported, providersOut, parents, dedup)) {
          if (importTypesWithProviders === undefined) importTypesWithProviders = [];
          // If the processed import is an injector type with providers, we store it in the
          // list of import types with providers, so that we can process those afterwards.
          importTypesWithProviders.push(imported);
        }
      });
    } finally {
      // Remove it from the parents set when finished.
      ngDevMode && parents.pop();
    }

    // Imports which are declared with providers (TypeWithProviders) need to be processed
    // after all imported modules are processed. This is similar to how View Engine
    // processes/merges module imports in the metadata resolver. See: FW-1349.
    if (importTypesWithProviders !== undefined) {
      for (let i = 0; i < importTypesWithProviders.length; i++) {
        const {ngModule, providers} = importTypesWithProviders[i];
        deepForEach(providers!, provider => {
          validateProvider(provider, providers || EMPTY_ARRAY, ngModule);
          providersOut.push(provider);
        });
      }
    }
  }

  if (ngModuleType && ngModuleDef) {
    // Track the InjectorType and add a provider for it.
    // It's important that this is done after the def's imports.
    const factory = getFactoryDef(ngModuleType) || (() => new ngModuleType!());

    // Provider to create `defType` using its factory.
    providersOut.push({
      provide: ngModuleType,
      useFactory: factory,
      deps: EMPTY_ARRAY,
    });

    providersOut.push({
      provide: INJECTOR_DEF_TYPES,
      useValue: ngModuleType,
      multi: true,
    });

    // Provider to eagerly instantiate `defType` via `INJECTOR_INITIALIZER`.
    providersOut.push({
      provide: INJECTOR_INITIALIZER,
      useValue: () => inject(ngModuleType!),
      multi: true,
    });

    // Next, include providers listed on the definition itself.
    const defProviders = ngModuleDef.providers;
    if (defProviders != null && !isDuplicate) {
      const injectorType = container as InjectorType<any>;
      deepForEach(defProviders, provider => {
        // TODO: fix cast
        validateProvider(provider, defProviders as any[], injectorType);
        providersOut.push(provider);
      });
    }
  }

  return (
      ngModule !== undefined &&
      (container as InjectorTypeWithProviders<any>).providers !== undefined);
}

/**
 * Collects providers from all NgModules (transitively for all imported NgModules as well).
 *
 * @returns The list of collected providers from the specified list of NgModules.
 */
export function importProvidersFrom(...injectorTypes: Array<Type<unknown>>): StaticProvider[] {
  const providers: SingleProvider[] = [];
  deepForEach(
      injectorTypes, injectorDef => walkProviderTree(injectorDef, providers, [], new Set()));
  // TODO: fix types
  return providers as StaticProvider[];
}

export class R3Injector {
  /**
   * Map of tokens to records which contain the instances of those tokens.
   * - `null` value implies that we don't have the record. Used by tree-shakable injectors
   * to prevent further searches.
   */
  private records = new Map<ProviderToken<any>, Record<any>|null>();

  /**
   * Set of values instantiated by this injector which contain `ngOnDestroy` lifecycle hooks.
   */
  private onDestroy = new Set<OnDestroy>();

  /**
   * Flag indicating this injector provides the APP_ROOT_SCOPE token, and thus counts as the
   * root scope.
   */
  private readonly scope: 'root'|'platform'|null;

  /**
   * Flag indicating that this injector was previously destroyed.
   */
  get destroyed(): boolean {
    return this._destroyed;
  }
  private _destroyed = false;

  private injectorDefTypes: Set<Type<unknown>>;

  constructor(
      providers: StaticProvider[], readonly parent: Injector, readonly source: string|null = null) {
    // Start off by creating Records for every provider.
    for (const provider of providers) {
      this.processProvider(provider as SingleProvider);
    }

    // Make sure the INJECTOR token provides this injector.
    this.records.set(INJECTOR, makeRecord(undefined, this));

    // Detect whether this injector has the APP_ROOT_SCOPE token and thus should provide
    // any injectable scoped to APP_ROOT_SCOPE.
    const record = this.records.get(INJECTOR_SCOPE);
    this.scope = record != null ? record.value : null;

    this.injectorDefTypes = new Set(this.get(INJECTOR_DEF_TYPES.multi, EMPTY_ARRAY));
  }

  /**
   * Destroy the injector and release references to every instance or provider associated with it.
   *
   * Also calls the `OnDestroy` lifecycle hooks of every instance that was created for which a
   * hook was found.
   */
  destroy(): void {
    this.assertNotDestroyed();

    // Set destroyed = true first, in case lifecycle hooks re-enter destroy().
    this._destroyed = true;
    try {
      // Call all the lifecycle hooks.
      for (const service of this.onDestroy) {
        service.ngOnDestroy();
      }
    } finally {
      // Release all references.
      this.records.clear();
      this.onDestroy.clear();
      this.injectorDefTypes.clear();
    }
  }

  get<T>(
      token: ProviderToken<T>, notFoundValue: any = THROW_IF_NOT_FOUND,
      flags = InjectFlags.Default): T {
    this.assertNotDestroyed();
    // Set the injection context.
    const previousInjector = setCurrentInjector(this);
    const previousInjectImplementation = setInjectImplementation(undefined);
    try {
      // Check for the SkipSelf flag.
      if (!(flags & InjectFlags.SkipSelf)) {
        // SkipSelf isn't set, check if the record belongs to this injector.
        let record: Record<T>|undefined|null = this.records.get(token);
        if (record === undefined) {
          // No record, but maybe the token is scoped to this injector. Look for an injectable
          // def with a scope matching this injector.
          const def = couldBeInjectableType(token) && getInjectableDef(token);
          if (def && this.injectableDefInScope(def)) {
            // Found an injectable def and it's scoped to this injector. Pretend as if it was here
            // all along.
            record = makeRecord(injectableDefOrInjectorDefFactory(token), NOT_YET);
          } else {
            record = null;
          }
          this.records.set(token, record);
        }
        // If a record was found, get the instance for it and return it.
        if (record != null /* NOT null || undefined */) {
          return this.hydrate(token, record);
        }
      }

      // Select the next injector based on the Self flag - if self is set, the next injector is
      // the NullInjector, otherwise it's the parent.
      const nextInjector = !(flags & InjectFlags.Self) ? this.parent : getNullInjector();
      // Set the notFoundValue based on the Optional flag - if optional is set and notFoundValue
      // is undefined, the value is null, otherwise it's the notFoundValue.
      notFoundValue = (flags & InjectFlags.Optional) && notFoundValue === THROW_IF_NOT_FOUND ?
          null :
          notFoundValue;
      return nextInjector.get(token, notFoundValue);
    } catch (e: any) {
      if (e.name === 'NullInjectorError') {
        const path: any[] = e[NG_TEMP_TOKEN_PATH] = e[NG_TEMP_TOKEN_PATH] || [];
        path.unshift(stringify(token));
        if (previousInjector) {
          // We still have a parent injector, keep throwing
          throw e;
        } else {
          // Format & throw the final error message when we don't have any previous injector
          return catchInjectorError(e, token, 'R3InjectorError', this.source);
        }
      } else {
        throw e;
      }
    } finally {
      // Lastly, restore the previous injection context.
      setInjectImplementation(previousInjectImplementation);
      setCurrentInjector(previousInjector);
    }
  }

  /** @internal */
  resolveInjectorInitializers() {
    const previousInjector = setCurrentInjector(this);
    const previousInjectImplementation = setInjectImplementation(undefined);
    try {
      const initializers = this.get(INJECTOR_INITIALIZER.multi, EMPTY_ARRAY);
      for (const initializer of initializers) {
        initializer();
      }
    } finally {
      setCurrentInjector(previousInjector);
      setInjectImplementation(previousInjectImplementation);
    }
  }

  toString() {
    const tokens: string[] = [];
    const records = this.records;
    for (const token of records.keys()) {
      tokens.push(stringify(token));
    }
    return `R3Injector[${tokens.join(', ')}]`;
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new RuntimeError(
          RuntimeErrorCode.INJECTOR_ALREADY_DESTROYED,
          ngDevMode && 'Injector has already been destroyed.');
    }
  }

  /**
   * Process a `SingleProvider` and add it.
   */
  private processProvider(provider: SingleProvider): void {
    // Determine the token from the provider. Either it's its own token, or has a {provide: ...}
    // property.
    provider = resolveForwardRef(provider);
    let token: any =
        isTypeProvider(provider) ? provider : resolveForwardRef(provider && provider.provide);

    // Construct a `Record` for the provider.
    const record = providerToRecord(provider);

    if (!isTypeProvider(provider) && provider.multi === true) {
      // If the provider indicates that it's a multi-provider, process it specially.
      // First check whether it's been defined already.
      let multiRecord = this.records.get(token);
      if (multiRecord) {
        // It has. Throw a nice error if
        if (ngDevMode && multiRecord.multi === undefined) {
          throwMixedMultiProviderError();
        }
      } else {
        multiRecord = makeRecord(undefined, NOT_YET, true);
        multiRecord.factory = () => injectArgs(multiRecord!.multi!);
        this.records.set(token, multiRecord);
      }
      token = provider;
      multiRecord.multi!.push(provider);
    } else {
      const existing = this.records.get(token);
      if (ngDevMode && existing && existing.multi !== undefined) {
        throwMixedMultiProviderError();
      }
    }
    this.records.set(token, record);
  }

  private hydrate<T>(token: ProviderToken<T>, record: Record<T>): T {
    if (ngDevMode && record.value === CIRCULAR) {
      throwCyclicDependencyError(stringify(token));
    } else if (record.value === NOT_YET) {
      record.value = CIRCULAR;
      record.value = record.factory!();
    }
    if (typeof record.value === 'object' && record.value && hasOnDestroy(record.value)) {
      this.onDestroy.add(record.value);
    }
    return record.value as T;
  }

  private injectableDefInScope(def: ɵɵInjectableDeclaration<any>): boolean {
    if (!def.providedIn) {
      return false;
    }
    const providedIn = resolveForwardRef(def.providedIn);
    if (typeof providedIn === 'string') {
      return providedIn === 'any' || (providedIn === this.scope);
    } else {
      return this.injectorDefTypes.has(providedIn);
    }
  }
}

function injectableDefOrInjectorDefFactory(token: ProviderToken<any>): FactoryFn<any> {
  // Most tokens will have an injectable def directly on them, which specifies a factory directly.
  const injectableDef = getInjectableDef(token);
  const factory = injectableDef !== null ? injectableDef.factory : getFactoryDef(token);

  if (factory !== null) {
    return factory;
  }

  // InjectionTokens should have an injectable def (ɵprov) and thus should be handled above.
  // If it's missing that, it's an error.
  if (token instanceof InjectionToken) {
    throw new RuntimeError(
        RuntimeErrorCode.INVALID_INJECTION_TOKEN,
        ngDevMode && `Token ${stringify(token)} is missing a ɵprov definition.`);
  }

  // Undecorated types can sometimes be created if they have no constructor arguments.
  if (token instanceof Function) {
    return getUndecoratedInjectableFactory(token);
  }

  // There was no way to resolve a factory for this token.
  throw new RuntimeError(RuntimeErrorCode.INVALID_INJECTION_TOKEN, ngDevMode && 'unreachable');
}

function getUndecoratedInjectableFactory(token: Function) {
  // If the token has parameters then it has dependencies that we cannot resolve implicitly.
  const paramLength = token.length;
  if (paramLength > 0) {
    const args: string[] = newArray(paramLength, '?');
    throw new RuntimeError(
        RuntimeErrorCode.INVALID_INJECTION_TOKEN,
        ngDevMode && `Can't resolve all parameters for ${stringify(token)}: (${args.join(', ')}).`);
  }

  // The constructor function appears to have no parameters.
  // This might be because it inherits from a super-class. In which case, use an injectable
  // def from an ancestor if there is one.
  // Otherwise this really is a simple class with no dependencies, so return a factory that
  // just instantiates the zero-arg constructor.
  const inheritedInjectableDef = getInheritedInjectableDef(token);
  if (inheritedInjectableDef !== null) {
    return () => inheritedInjectableDef.factory(token as Type<any>);
  } else {
    return () => new (token as Type<any>)();
  }
}

function providerToRecord(provider: SingleProvider): Record<any> {
  if (isValueProvider(provider)) {
    return makeRecord(undefined, provider.useValue);
  } else {
    const factory: (() => any)|undefined = providerToFactory(provider);
    return makeRecord(factory, NOT_YET);
  }
}

/**
 * Converts a `SingleProvider` into a factory function.
 *
 * @param provider provider to convert to factory
 */
export function providerToFactory(
    provider: SingleProvider, ngModuleType?: InjectorType<any>, providers?: any[]): () => any {
  let factory: (() => any)|undefined = undefined;
  if (isTypeProvider(provider)) {
    const unwrappedProvider = resolveForwardRef(provider);
    return getFactoryDef(unwrappedProvider) || injectableDefOrInjectorDefFactory(unwrappedProvider);
  } else {
    if (isValueProvider(provider)) {
      factory = () => resolveForwardRef(provider.useValue);
    } else if (isFactoryProvider(provider)) {
      factory = () => provider.useFactory(...injectArgs(provider.deps || []));
    } else if (isExistingProvider(provider)) {
      factory = () => ɵɵinject(resolveForwardRef(provider.useExisting));
    } else {
      const classRef = resolveForwardRef(
          provider &&
          ((provider as StaticClassProvider | ClassProvider).useClass || provider.provide));
      if (ngDevMode && !classRef) {
        debugger;
        throwInvalidProviderError(ngModuleType, providers, provider);
      }
      if (hasDeps(provider)) {
        factory = () => new (classRef)(...injectArgs(provider.deps));
      } else {
        return getFactoryDef(classRef) || injectableDefOrInjectorDefFactory(classRef);
      }
    }
  }
  return factory;
}

function makeRecord<T>(
    factory: (() => T)|undefined, value: T|{}, multi: boolean = false): Record<T> {
  return {
    factory: factory,
    value: value,
    multi: multi ? [] : undefined,
  };
}

function isValueProvider(value: SingleProvider): value is ValueProvider {
  return value !== null && typeof value == 'object' && USE_VALUE in value;
}

function isExistingProvider(value: SingleProvider): value is ExistingProvider {
  return !!(value && (value as ExistingProvider).useExisting);
}

function isFactoryProvider(value: SingleProvider): value is FactoryProvider {
  return !!(value && (value as FactoryProvider).useFactory);
}

export function isTypeProvider(value: SingleProvider): value is TypeProvider {
  return typeof value === 'function';
}

export function isClassProvider(value: SingleProvider): value is ClassProvider {
  return !!(value as StaticClassProvider | ClassProvider).useClass;
}

function hasDeps(value: ClassProvider|ConstructorProvider|
                 StaticClassProvider): value is ClassProvider&{deps: any[]} {
  return !!(value as any).deps;
}

function hasOnDestroy(value: any): value is OnDestroy {
  return value !== null && typeof value === 'object' &&
      typeof (value as OnDestroy).ngOnDestroy === 'function';
}

function couldBeInjectableType(value: any): value is ProviderToken<any> {
  return (typeof value === 'function') ||
      (typeof value === 'object' && value instanceof InjectionToken);
}

function validateProvider(
    provider: SingleProvider, providers: SingleProvider[], containerType: Type<unknown>): void {
  if (isTypeProvider(provider) || isValueProvider(provider) || isFactoryProvider(provider) ||
      isExistingProvider(provider)) {
    return;
  }

  // Here we expect the provider to be a `useClass` provider (by elimination).
  const classRef = resolveForwardRef(
      provider && ((provider as StaticClassProvider | ClassProvider).useClass || provider.provide));
  if (ngDevMode && !classRef) {
    throwInvalidProviderError(containerType, providers, provider);
  }
}
