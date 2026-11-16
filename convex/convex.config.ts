import { defineApp } from 'convex/server';
import { v } from 'convex/values';

export default defineApp({
  env: {
    WHOP_ENVIRONMENT: v.optional(v.string()),
    WHOP_SANDBOX_API_KEY: v.optional(v.string()),
    WHOP_SANDBOX_WEBHOOK_SECRET: v.optional(v.string()),
    WHOP_SANDBOX_ACCOUNT_ID: v.optional(v.string()),
    WHOP_SANDBOX_VARIANT_ID: v.optional(v.string()),
    WHOP_SANDBOX_POINTS_100_VARIANT_ID: v.optional(v.string()),
    WHOP_SANDBOX_POINTS_550_VARIANT_ID: v.optional(v.string()),
    WHOP_SANDBOX_POINTS_1200_VARIANT_ID: v.optional(v.string()),
    WHOP_SANDBOX_PIGEON_VARIANT_ID: v.optional(v.string()),
    WHOP_LIVE_API_KEY: v.optional(v.string()),
    WHOP_LIVE_WEBHOOK_SECRET: v.optional(v.string()),
    WHOP_LIVE_ACCOUNT_ID: v.optional(v.string()),
    WHOP_LIVE_VARIANT_ID: v.optional(v.string()),
    WHOP_LIVE_POINTS_100_VARIANT_ID: v.optional(v.string()),
    WHOP_LIVE_POINTS_550_VARIANT_ID: v.optional(v.string()),
    WHOP_LIVE_POINTS_1200_VARIANT_ID: v.optional(v.string()),
    WHOP_LIVE_PIGEON_VARIANT_ID: v.optional(v.string()),
    PIGEON_PRICE_CENTS: v.optional(v.string()),
    PIGEON_PUBLIC_ORIGIN: v.optional(v.string()),
  },
});
