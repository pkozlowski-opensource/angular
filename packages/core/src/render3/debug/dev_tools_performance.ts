/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {InjectionToken, ProviderToken} from '../../di';
import {isTypeProvider} from '../../di/provider_collection';
import {Profiler, ProfilerEvent} from '../profiler_types';
import {
  InjectorProfiler,
  InjectorProfilerEvent,
  InjectorProfilerEventType,
} from './injector_profiler';
import {setProfiler} from '../profiler';
import {stringifyForError} from '../util/stringify_utils';

// TODO: verify what is exported from this file, re-export in some entry point
// TODO: only in dev mode for now?
const devToolsInjectorProfiler: InjectorProfiler = (event: InjectorProfilerEvent) => {
  const eventType = event.type;
  if (
    eventType === InjectorProfilerEventType.Inject ||
    eventType === InjectorProfilerEventType.InstanceCreatedByInjector
  ) {
    const token = event.context.token;
  }
};

const profilerEventTimingStack: DOMHighResTimeStamp[] = [];
let changeDetectionRuns = 0;
let changeDetectionSyncRuns = 0;

function getStartTime(): DOMHighResTimeStamp {
  const startTime = profilerEventTimingStack.pop();
  if (startTime === undefined) {
    throw new Error('Missing start event');
  }
  return startTime;
}

function measure(entryName: string, start: DOMHighResTimeStamp, detail: any) {
  performance.measure(entryName, {
    start: start,
    end: performance.now(),
    detail: detail,
  });
}

const devToolsProfiler: Profiler = (
  event: ProfilerEvent,
  instance?: {} | null,
  hookOrListener?: (e?: any) => any,
) => {
  switch (event) {
    case ProfilerEvent.BootstrapApplicationStart:
    case ProfilerEvent.BootstrapComponentStart:
    case ProfilerEvent.ChangeDetectionStart:
    case ProfilerEvent.ChangeDetectionSyncStart:
    case ProfilerEvent.AfterRenderHooksStart:
    case ProfilerEvent.ComponentStart:
    case ProfilerEvent.DeferBlockStateStart:
    case ProfilerEvent.DynamicComponentStart:
    case ProfilerEvent.TemplateCreateStart:
    case ProfilerEvent.LifecycleHookStart:
    case ProfilerEvent.TemplateUpdateStart:
    case ProfilerEvent.HostBindingsUpdateStart:
    case ProfilerEvent.OutputStart: {
      profilerEventTimingStack.push(performance.now());
      break;
    }
    case ProfilerEvent.BootstrapApplicationEnd: {
      measureEntryPoint('Bootstrap application', getStartTime());
      break;
    }
    case ProfilerEvent.BootstrapComponentEnd: {
      measureEntryPoint('Bootstrap component', getStartTime());
      break;
    }
    case ProfilerEvent.ChangeDetectionEnd: {
      measureEntryPoint('Change detection ' + changeDetectionRuns++, getStartTime());
      changeDetectionSyncRuns = 0;
      break;
    }
    case ProfilerEvent.ChangeDetectionSyncEnd: {
      measureSecondaryEntryPoint('Synchronization ' + changeDetectionSyncRuns++, getStartTime());
      break;
    }
    case ProfilerEvent.AfterRenderHooksEnd: {
      measureSecondaryEntryPoint('After render hooks', getStartTime());
      break;
    }
    case ProfilerEvent.ComponentEnd: {
      measureTertiaryEntryPoint(instance, getStartTime());
      break;
    }
    case ProfilerEvent.DeferBlockStateEnd: {
      measureEntryPoint('Defer block', getStartTime());
      break;
    }
    case ProfilerEvent.DynamicComponentEnd: {
      measureEntryPoint('Dynamic component creation', getStartTime());
      break;
    }
    case ProfilerEvent.TemplateUpdateEnd: {
      measureGeneratedCodeUpdate('Template update', getStartTime());
      break;
    }
    case ProfilerEvent.TemplateCreateEnd: {
      measureGeneratedCodeCreate('Template create', getStartTime());
      break;
    }
    case ProfilerEvent.HostBindingsUpdateEnd: {
      measureGeneratedCodeUpdate('HostBindings', getStartTime());
      break;
    }
    case ProfilerEvent.LifecycleHookEnd: {
      // TODO: !
      measureCodeLifecycleHook(instance, hookOrListener!, getStartTime());
      break;
    }
    case ProfilerEvent.OutputEnd: {
      // TODO: !
      measureCodeListener(instance, hookOrListener!, getStartTime());
      break;
    }
    default: {
      // TODO: assert or something else
      throw new Error('Unhandled event type: ' + event);
    }
  }
};

// TODO: I guess this is also a public API we should expose?
export function enableProfiling() {
  // TODO: how to restore the previous profiler? More broadly, how to avoid override of whatever others are setting?
  // setInjectorProfiler(devToolsInjectorProfiler);
  setProfiler(devToolsProfiler);
}

// TODO: proper way of dealing with globals?
// TODO: manual enabling like this doesn't land itself nicely to profiling startup of an app
// (window as any).enableProfiling = enableProfiling;

// TODO: remove auto-enable when done with testing
enableProfiling();

function colorToDetail(color: string) {
  return {
    devtools: {
      color,
      track: '\u{1F170}\uFE0F Angular',
    },
  };
}

// TODO(perf): pulling it outside to avoid repeated instantiation. Sadly, this limit my options of providing additional details (ex.: description)
const PRIMARY_DARK_DETAIL = colorToDetail('primary-dark');
const PRIMARY_DETAIL = colorToDetail('primary');
const PRIMARY_LIGHT_DETAIL = colorToDetail('primary-light');
const SECONDARY_DARK_DETAIL = colorToDetail('secondary-dark');
const SECONDARY_DETAIL = colorToDetail('secondary');
const TERTIARY_DARK_DETAIL = colorToDetail('tertiary-dark');
const TERTIARY_DETAIL = colorToDetail('tertiary');
const TERTIARY_LIGHT_DETAIL = colorToDetail('tertiary-light');

function getProviderTokenMeasureName<T>(token: any) {
  if (token instanceof InjectionToken) {
    return token.toString();
  } else {
    if (isTypeProvider(token)) {
      return token.name;
    } else {
      return getProviderTokenMeasureName(token.provide);
    }
  }
}

function measureEntryPoint(entryName: string, start: DOMHighResTimeStamp) {
  measure(entryName, start, PRIMARY_DARK_DETAIL);
}

function measureSecondaryEntryPoint(entryName: string, start: DOMHighResTimeStamp) {
  measure(entryName, start, PRIMARY_DETAIL);
}

function measureTertiaryEntryPoint(cmpInstance: any, start: DOMHighResTimeStamp) {
  // TODO: better logic of resolving a useful name
  const entryName = cmpInstance.constructor.name;
  measure(entryName, start, PRIMARY_LIGHT_DETAIL);
}

function measureGeneratedCodeCreate<T>(detail: string, start: DOMHighResTimeStamp) {
  measure(detail, start, SECONDARY_DETAIL);
}

function measureGeneratedCodeUpdate<T>(detail: string, start: DOMHighResTimeStamp) {
  measure(detail, start, SECONDARY_DARK_DETAIL);
}

export function measureCodeInstantiate<T>(token: ProviderToken<T>, start: DOMHighResTimeStamp) {
  measure(getProviderTokenMeasureName(token), start, TERTIARY_DARK_DETAIL);
}

function measureCodeListener<T>(instance: any, listenerFn: Function, start: DOMHighResTimeStamp) {
  measure(stringifyForError(listenerFn.name), start, TERTIARY_LIGHT_DETAIL);
}

function measureCodeLifecycleHook<T>(
  instance: any,
  hookFn: (e?: any) => any,
  start: DOMHighResTimeStamp,
) {
  measure(stringifyForError(stringifyForError(hookFn.name)), start, TERTIARY_DETAIL);
}
