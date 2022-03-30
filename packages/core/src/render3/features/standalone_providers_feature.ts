import {Type} from '../../core';
import {Provider} from '../../di';
import {getInjectorDef} from '../../di/interface/defs';
import {ComponentDef} from '../interfaces/definition';

/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * This feature resolves ambient providers from the import graph rooted at a given standalone
 * component.
 *
 *
 * @param definition
 *
 * @codeGenApi
 */
export function ɵɵstandaloneProvidersFeature<T>() {
  let resolved: Provider[]|undefined = undefined;
  return (definition: ComponentDef<T>) => {
    definition.ambientProviders = () => {
      if (resolved === undefined) {
        // TODO(pk): quick, dirty and naive implementation to make the test pass, needs an actual
        // implementation when we agree on the interface
        resolved =
            definition.dependencies?.reduce((providers: Provider[], dependency: Type<any>) => {
              const injectorDef = getInjectorDef(dependency);
              return [...providers, ...(injectorDef !== null ? injectorDef.providers : [])]
            }, []);
      }
      return resolved ?? [];
    }
  }
}