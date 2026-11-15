import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const read = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const counter = await ctx.db.query('starterDemo').withIndex('by_key', (q) => q.eq('key', 'shared')).unique();
    return counter?.value ?? 0;
  },
});

export const increment = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const counter = await ctx.db.query('starterDemo').withIndex('by_key', (q) => q.eq('key', 'shared')).unique();
    const value = ((counter?.value ?? 0) + 1) % 1000000;
    if (counter) await ctx.db.patch('starterDemo', counter._id, { value });
    else await ctx.db.insert('starterDemo', { key: 'shared', value });
    return value;
  },
});
