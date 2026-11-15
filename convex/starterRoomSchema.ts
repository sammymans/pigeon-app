import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const starterRoomTables = {
  starterRooms: defineTable({
    ownerId: v.id('profiles'), namespace: v.string(), members: v.array(v.id('profiles')),
    inviteToken: v.string(), expiresAt: v.number(), inviteOpen: v.boolean(),
  }).index('by_namespace', ['namespace']).index('by_inviteToken', ['inviteToken']),
};
