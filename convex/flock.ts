import { v } from 'convex/values';
import { query } from './_generated/server';
import { requireProfile } from './model';

export const list = query({
  args: {},
  returns: v.array(v.object({ id: v.string(), name: v.string(), ready: v.boolean(), deliveries: v.number(), flightId: v.optional(v.string()) })),
  handler: async ctx => {
    const owner = await requireProfile(ctx);
    const birds = await ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', owner._id)).collect();
    return Promise.all(birds.sort((a, b) => a.slot - b.slot).map(async bird => {
      const flights = await ctx.db.query('flights').withIndex('by_pigeonId', q => q.eq('pigeonId', bird._id)).collect();
      const active = flights.find(flight => flight.state === 'in_flight');
      return { id: bird._id, name: bird.name, ready: !active, deliveries: flights.filter(flight => flight.state === 'delivered').length, ...(active ? { flightId: active._id } : {}) };
    }));
  },
});
