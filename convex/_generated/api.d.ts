/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_extraction from "../ai/extraction.js";
import type * as ai_geocode from "../ai/geocode.js";
import type * as ai_model from "../ai/model.js";
import type * as ai_processScreenshot from "../ai/processScreenshot.js";
import type * as ai_results from "../ai/results.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as lib from "../lib.js";
import type * as notifications from "../notifications.js";
import type * as profile from "../profile.js";
import type * as screenshots from "../screenshots.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/extraction": typeof ai_extraction;
  "ai/geocode": typeof ai_geocode;
  "ai/model": typeof ai_model;
  "ai/processScreenshot": typeof ai_processScreenshot;
  "ai/results": typeof ai_results;
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  items: typeof items;
  lib: typeof lib;
  notifications: typeof notifications;
  profile: typeof profile;
  screenshots: typeof screenshots;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
