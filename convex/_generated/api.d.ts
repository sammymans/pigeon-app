/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as commerce from "../commerce.js";
import type * as commerceData from "../commerceData.js";
import type * as commerceSchema from "../commerceSchema.js";
import type * as demo from "../demo.js";
import type * as flightModel from "../flightModel.js";
import type * as flights from "../flights.js";
import type * as http from "../http.js";
import type * as model from "../model.js";
import type * as profiles from "../profiles.js";
import type * as social from "../social.js";
import type * as starterDemo from "../starterDemo.js";
import type * as validators from "../validators.js";
import type * as whop from "../whop.js";
import type * as whopNode from "../whopNode.js";
import type * as whopProtocol from "../whopProtocol.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  commerce: typeof commerce;
  commerceData: typeof commerceData;
  commerceSchema: typeof commerceSchema;
  demo: typeof demo;
  flightModel: typeof flightModel;
  flights: typeof flights;
  http: typeof http;
  model: typeof model;
  profiles: typeof profiles;
  social: typeof social;
  starterDemo: typeof starterDemo;
  validators: typeof validators;
  whop: typeof whop;
  whopNode: typeof whopNode;
  whopProtocol: typeof whopProtocol;
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
