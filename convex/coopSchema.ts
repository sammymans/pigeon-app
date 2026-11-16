import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const accessory = v.union(v.literal('cap'), v.literal('scarf'), v.literal('goggles'));
export const shopState = v.object({
  points: v.number(), stones: v.number(), stoneAt: v.number(), owned: v.array(accessory),
  equipped: v.array(v.object({ item: accessory, birdId: v.string() })),
  treats: v.number(), treatedBirds: v.array(v.string()), guardUntil: v.number(),
});
export const shopAction = v.union(
  v.object({ type: v.literal('accessory'), item: accessory, birdId: v.string() }),
  v.object({ type: v.literal('remove'), item: accessory }),
  v.object({ type: v.literal('treat'), birdId: v.string() }),
  v.object({ type: v.literal('buyTreat') }), v.object({ type: v.literal('guard') }), v.object({ type: v.literal('stones') }),
);
export const coopTables = {
  coopWallets: defineTable({ ownerId: v.id('profiles'), state: shopState }).index('by_ownerId', ['ownerId']),
  coopReceipts: defineTable({ ownerId: v.id('profiles'), requestKey: v.string(), action: shopAction })
    .index('by_ownerId_and_requestKey', ['ownerId', 'requestKey']),
};
