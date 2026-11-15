import { defineApp } from 'convex/server';
import { v } from 'convex/values';

export default defineApp({
  env: {
    WHOP_SANDBOX_API_KEY: v.optional(v.string()),
    WHOP_SANDBOX_WEBHOOK_SECRET: v.optional(v.string()),
    WHOP_SANDBOX_ACCOUNT_ID: v.optional(v.string()),
    WHOP_SANDBOX_VARIANT_ID: v.optional(v.string()),
    PIGEON_PUBLIC_ORIGIN: v.optional(v.string()),
  },
});
