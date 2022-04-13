/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component, ComponentFactoryResolver, createEnvInjector, EnvInjector, InjectionToken, INJECTOR, Injector, INJECTOR_INITIALIZER, NgModuleRef} from '@angular/core';

describe('environment injector', () => {
  it('should create and destroy an environment injector', () => {
    class Service {}

    let destroyed = false;
    const envInjector = createEnvInjector([Service]);
    envInjector.onDestroy(() => destroyed = true);

    const service = envInjector.get(Service);
    expect(service).toBeInstanceOf(Service);

    envInjector.destroy();
    expect(destroyed).toBeTrue();
  });

  it('should see providers from a parent EnvInjector', () => {
    class Service {}

    const envInjector = createEnvInjector([], createEnvInjector([Service]));
    expect(envInjector.get(Service)).toBeInstanceOf(Service);
  });

  it('should shadow providers from the parent EnvInjector', () => {
    const token = new InjectionToken('token')

    const envInjector = createEnvInjector(
        [{provide: token, useValue: 'child'}],
        createEnvInjector([{provide: token, useValue: 'parent'}]));
    expect(envInjector.get(token)).toBe('child');
  });

  it('should expose the Injector token', () => {
    const envInjector = createEnvInjector([]);
    expect(envInjector.get(Injector)).toBe(envInjector);
    expect(envInjector.get(INJECTOR)).toBe(envInjector);
  });

  it('should expose the EnvInjector token', () => {
    const envInjector = createEnvInjector([]);
    expect(envInjector.get(EnvInjector)).toBe(envInjector);
  });

  it('should expose the same object as both the Injector and EnvInjector token', () => {
    const envInjector = createEnvInjector([]);
    expect(envInjector.get(Injector)).toBe(envInjector.get(EnvInjector));
  });

  it('should expose the NgModuleRef token', () => {
    class Service {}
    const envInjector = createEnvInjector([Service]);

    const ngModuleRef = envInjector.get(NgModuleRef);

    expect(ngModuleRef).toBeInstanceOf(NgModuleRef);
    // NgModuleRef proxies to an Injector holding supplied providers
    expect(ngModuleRef.injector.get(Service)).toBeInstanceOf(Service);
    // There is no actual instance of @NgModule-annotated class
    expect(ngModuleRef.instance).toBeNull();
  });

  it('should expose the ComponentFactoryResolver token bound to env injector with specified providers',
     () => {
       class Service {}

       @Component({selector: 'test-cmp'})
       class TestComponent {
         constructor(readonly service: Service) {}
       }

       const envInjector = createEnvInjector([Service]);
       const cfr = envInjector.get(ComponentFactoryResolver);
       const cf = cfr.resolveComponentFactory(TestComponent);
       const cRef = cf.create(Injector.NULL);

       expect(cRef.instance.service).toBeInstanceOf(Service);
     });

  it('should support the INJECTOR_INITIALIZER muli-token', () => {
    let initialized = false;
    createEnvInjector([{
      provide: INJECTOR_INITIALIZER,
      useValue: () => initialized = true,
      multi: true,
    }]);

    expect(initialized).toBeTrue();
  });
});