import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  starterDemo: defineTable({ key: v.literal('shared'), value: v.number() }).index('by_key', ['key']),
});
