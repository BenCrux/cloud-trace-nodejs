/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// tslint:disable:no-any

import {Constants} from './constants';
import {TraceLabels} from './trace-labels';

export type Func<T> = (...args: any[]) => T;

// Defines an interface for storing Trace-Agent related data on patched modules.
export interface TraceAgentExtension { _google_trace_patched: boolean; }

/**
 * Represents a trace span.
 */
export interface SpanData {
  /**
   * Gets the current trace context serialized as a string.
   * @return The stringified trace context.
   */
  getTraceContext(): string;

  /**
   * Adds a key-value pair as a label to the trace span. The value will be
   * converted to a string if it is not already, and both the key and value may
   * be truncated according to the user's configuration.
   * @param key The label's key.
   * @param value The label's value.
   */
  addLabel(key: string, value: any): void;

  /**
   * Ends the span. This method should only be called once.
   */
  endSpan(): void;
}

/**
 * An interface that describes the available options for creating a span in
 * general.
 */
export interface SpanOptions {
  /* The name to apply to the span. */
  name: string;
  /**
   * The number of stack frames to skip when collecting call stack information
   * for the span, starting from the top; this should be set to avoid including
   * frames in the plugin. Defaults to 0.
   */
  skipFrames?: number;
}

/**
 * An interface that describes the available options for creating root spans.
 */
export interface RootSpanOptions extends SpanOptions {
  /* A URL associated with the root span, if applicable. */
  url?: string;
  /**
   * The serialized form of an object that contains information about an
   * existing trace context, if it exists.
   */
  traceContext?: string|null;
}

export interface TraceAgent {
  /**
   * Gets the value of enhancedDatabaseReporting in the trace agent's
   * configuration object.
   * @returns A boolean value indicating whether the trace agent was configured
   * to have an enhanced level of reporting enabled.
   */
  enhancedDatabaseReportingEnabled(): boolean;

  /**
   * Runs the given function in a root span corresponding to an incoming
   * request, possibly passing it an object that exposes an interface for adding
   * labels and closing the span.
   * @param options An object that specifies options for how the root
   * span is created and propogated.
   * @param fn A function that will be called exactly
   * once. If the incoming request should be traced, a root span will be
   * created, and this function will be called with a RootSpan object exposing
   * functions operating on the root span; otherwise, it will be called with
   * null as an argument.
   * @returns The return value of calling fn.
   */
  runInRootSpan<T>(options: RootSpanOptions, fn: (span: SpanData|null) => T): T;
  /**
   * Returns a unique identifier for the currently active context. This can be
   * used to uniquely identify the current root span. If there is no current,
   * context, or if we have lost context, this will return null. The structure
   * and the length of the returned string should be treated opaquely - the only
   * guarantee is that the value would unique for every root span.
   * @returns an id for the current context, or null if there is none
   */
  getCurrentContextId(): string|null;
  /**
   * Returns the projectId that was either configured or auto-discovered by the
   * TraceWriter. Note that the auto-discovery is done asynchronously, so this
   * may return falsey until the projectId auto-discovery completes.
   */
  getWriterProjectId(): string|null;

  /**
   * Creates and returns a new ChildSpan object nested within the root span. If
   * there is no current RootSpan object, this function returns null.
   * @param options An object that specifies options for how the child
   * span is created and propagated.
   * @returns A new SpanData object, or null if there is no active root span.
   */
  createChildSpan(options: SpanOptions): SpanData|null;

  /**
   * Generates a stringified trace context that should be set as the trace
   * context header in a response to an incoming web request. This value is
   * based on the trace context header value in the corresponding incoming
   * request, as well as the result from the local trace policy on whether this
   * request will be traced or not.
   * @param incomingTraceContext The trace context that was attached to
   * the incoming web request, or null if the incoming request didn't have one.
   * @param isTraced Whether the incoming was traced. This is determined
   * by the local tracing policy.
   * @returns If the response should contain the trace context within its
   * header, the string to be set as this header's value. Otherwise, an empty
   * string.
   */
  getResponseTraceContext(incomingTraceContext: string|null, isTraced: boolean):
      string;

  /**
   * Binds the trace context to the given function.
   * This is necessary in order to create child spans correctly in functions
   * that are called asynchronously (for example, in a network response
   * handler).
   * @param fn A function to which to bind the trace context.
   */
  wrap<T>(fn: Func<T>): Func<T>;

  /**
   * Binds the trace context to the given event emitter.
   * This is necessary in order to create child spans correctly in event
   * handlers.
   * @param emitter An event emitter whose handlers should have
   * the trace context binded to them.
   */
  wrapEmitter(emitter: NodeJS.EventEmitter): void;

  readonly constants: typeof Constants;
  readonly labels: typeof TraceLabels;
}

export interface Patch<T> {
  file?: string;
  versions?: string;
  patch: (module: T, agent: TraceAgent) => void;
  unpatch?: (module: T) => void;
}

export interface Intercept<T> {
  file?: string;
  versions?: string;
  intercept: (module: T, agent: TraceAgent) => T;
}

export type Instrumentation<T> = Patch<T>|Intercept<T>;

export type Plugin = Array<Instrumentation<any>>;
