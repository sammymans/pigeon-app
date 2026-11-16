import { ConvexError, v } from 'convex/values';
import { isHit } from '../src/domain';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { catchEligible, slingshotEligible, finishAttempt, launchFor, settleFlight, summaryProjection } from './flightModel';
import { areBlocked, optionalProfile, pairKey, requireProfile } from './model';
import { attemptDto, defense, detailDto, resultDto, summaryDto, visibility } from './validators';

export const list = query({
  args: { scope: v.union(v.literal('mine'), v.literal('world')), demo: v.boolean() },
  returns: v.object({ flights: v.array(summaryDto), total: v.number(), serverTime: v.number() }),
  handler: async (ctx, args) => {
    if (args.scope === 'world') {
      const viewer = args.demo ? await optionalProfile(ctx) : null;
      if (viewer?.demo) {
        const flights = await ctx.db.query('flights').withIndex('by_namespace_and_visibility_and_state', (q) => q.eq('namespace', viewer.namespace).eq('visibility', 'open').eq('state', 'in_flight')).order('desc').take(30);
        return { flights: await Promise.all(flights.map((flight) => summaryProjection(ctx, flight, null))), total: flights.length, serverTime: Math.max(0, ...flights.map((flight) => flight.updatedAt)) };
      }
      const flights = await ctx.db.query('flights').withIndex('by_demo_and_visibility_and_state', (q) => q.eq('demo', args.demo).eq('visibility', 'open').eq('state', 'in_flight')).order('desc').take(30);
      const stats = await ctx.db.query('skyStats').withIndex('by_demo', (q) => q.eq('demo', args.demo)).unique();
      return { flights: await Promise.all(flights.map((flight) => summaryProjection(ctx, flight, null))), total: stats?.active ?? 0, serverTime: stats?.updatedAt ?? 0 };
    }
    const profile = await requireProfile(ctx);
    const [sent, received, caught] = await Promise.all([
      ctx.db.query('flights').withIndex('by_senderId_and_demo', (q) => q.eq('senderId', profile._id).eq('demo', args.demo)).order('desc').take(100),
      ctx.db.query('flights').withIndex('by_recipientId_and_demo', (q) => q.eq('recipientId', profile._id).eq('demo', args.demo)).order('desc').take(100),
      ctx.db.query('flights').withIndex('by_catcherId_and_demo', (q) => q.eq('catcherId', profile._id).eq('demo', args.demo)).order('desc').take(100),
    ]);
    const flights = [...sent, ...received, ...caught].sort((a, b) => b.departedAt - a.departedAt);
    return { flights: await Promise.all(flights.map((flight) => summaryProjection(ctx, flight, profile))), total: flights.length, serverTime: Math.max(0, ...flights.map((flight) => flight.updatedAt)) };
  },
});

export const detail = query({
  args: { id: v.string() }, returns: v.object({ flight: v.union(detailDto, v.null()), serverTime: v.number() }),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId('flights', args.id);
    const flight = id ? await ctx.db.get('flights', id) : await ctx.db.query('flights').withIndex('by_shareToken', (q) => q.eq('shareToken', args.id)).unique();
    if (!flight) return { flight: null, serverTime: 0 };
    const viewer = id ? await optionalProfile(ctx) : null;
    if (flight.visibility === 'sealed' && viewer?._id !== flight.senderId && viewer?._id !== flight.recipientId) return { flight: null, serverTime: 0 };
    const summary = await summaryProjection(ctx, flight, viewer);
    const canRead = summary.role === 'sender' || (summary.role === 'recipient' && flight.state === 'delivered') || (summary.role === 'catcher' && flight.state === 'intercepted');
    const message = canRead ? await ctx.db.query('messages').withIndex('by_flightId', (q) => q.eq('flightId', flight._id)).unique() : null;
    const connection = summary.role === 'catcher' && viewer ? await ctx.db.query('connections').withIndex('by_pairKey', (q) => q.eq('pairKey', pairKey(viewer._id, flight.senderId))).unique() : null;
    return {
      flight: {
        ...summary, ...(message ? { body: message.body } : {}), events: flight.events,
        canCatch: Boolean(id) && await catchEligible(ctx, flight, viewer),
        canSlingshot: Boolean(id) && await slingshotEligible(ctx, flight, viewer),
        canRequest: summary.role === 'catcher' && !connection && Boolean(viewer) && !(await areBlocked(ctx, flight.senderId, viewer!._id)),
        canResend: summary.role === 'sender' && flight.state === 'intercepted',
        ...(summary.role === 'sender' ? { otherProfileId: flight.recipientId } : summary.role === 'recipient' || summary.role === 'catcher' ? { otherProfileId: flight.senderId } : {}),
      }, serverTime: flight.updatedAt,
    };
  },
});

export const launch = mutation({
  args: { recipientId: v.string(), body: v.string(), visibility, defense, openAcknowledged: v.boolean(), demo: v.boolean(), requestKey: v.string() },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => ({ id: await launchFor(ctx, await requireProfile(ctx), args) }),
});

export const settleMine = mutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const now = Date.now();
    const sent = await ctx.db.query('flights').withIndex('by_senderId_and_state', (q) => q.eq('senderId', profile._id).eq('state', 'in_flight')).take(4);
    const received = await ctx.db.query('flights').withIndex('by_recipientId_and_state', (q) => q.eq('recipientId', profile._id).eq('state', 'in_flight')).take(100);
    for (const flight of [...sent, ...received]) await settleFlight(ctx, flight, now);
    return null;
  },
});

export const reserve = mutation({
  args: { flightId: v.string() }, returns: attemptDto,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const id = ctx.db.normalizeId('flights', args.flightId);
    let flight = id ? await ctx.db.get('flights', id) : null;
    const now = Date.now();
    if (!flight || flight.visibility !== 'open' || flight.state !== 'in_flight' || flight.namespace !== profile.namespace || flight.senderId === profile._id || flight.recipientId === profile._id) throw new ConvexError('This pigeon cannot be caught.');
    if (flight.activeEncounterId) throw new ConvexError('Another interception is in progress.');
    if (await ctx.db.query('slingshotEncounters').withIndex('by_flightId_and_catcherId', q => q.eq('flightId', flight!._id).eq('catcherId', profile._id)).unique()) throw new ConvexError('You already attempted this pigeon.');
    if (await areBlocked(ctx, profile._id, flight.senderId) || await areBlocked(ctx, profile._id, flight.recipientId)) throw new ConvexError('This pigeon cannot be caught.');
    const prior = await ctx.db.query('catchAttempts').withIndex('by_flightId_and_catcherId', (q) => q.eq('flightId', flight!._id).eq('catcherId', profile._id)).unique();
    if (prior && !prior.outcome && prior.expiresAt > now && flight.activeAttemptId === prior._id) {
      return { id: prior._id, flightId: flight._id, phases: prior.phases, startedAt: prior.startedAt, expiresAt: prior.expiresAt, serverTime: now, defense: flight.defense };
    }
    if (flight.arrivesAt - now <= 15_000) throw new ConvexError('This pigeon is too close to arrival.');
    if (prior) throw new ConvexError('You already tried to catch this pigeon.');
    if (flight.attemptCount >= 2) throw new ConvexError('This pigeon has outflown its two attempts.');
    if ((profile.catchCooldownUntil ?? 0) > now) throw new ConvexError('Wait 30 seconds between catch attempts.');
    if (flight.activeAttemptId) {
      const active = await ctx.db.get('catchAttempts', flight.activeAttemptId);
      if (active && !active.outcome && active.expiresAt > now) throw new ConvexError('Someone else is catching this pigeon.');
      if (active && !active.outcome) await finishAttempt(ctx, flight, active, 'expired', [false, false, false], now);
      flight = (await ctx.db.get('flights', flight._id))!;
    }
    const phases = Array.from({ length: 3 }, () => Math.random() * Math.PI * 2);
    const expiresAt = now + 10_000;
    const attemptId = await ctx.db.insert('catchAttempts', { flightId: flight._id, catcherId: profile._id, namespace: flight.namespace, phases, startedAt: now, expiresAt });
    await ctx.db.patch('flights', flight._id, { activeAttemptId: attemptId, attemptCount: flight.attemptCount + 1, updatedAt: now, events: [...flight.events, { at: now, label: 'Catch attempt started' }] });
    await ctx.db.patch('profiles', profile._id, { catchCooldownUntil: now + 30_000, catchCoolingDown: true });
    await ctx.scheduler.runAt(expiresAt, internal.flights.expireAttempt, { attemptId });
    await ctx.scheduler.runAt(now + 30_000, internal.flights.clearCooldown, { profileId: profile._id, until: now + 30_000 });
    return { id: attemptId, flightId: flight._id, phases, startedAt: now, expiresAt, serverTime: now, defense: flight.defense };
  },
});

export const resolve = mutation({
  args: { attemptId: v.string(), taps: v.array(v.union(v.number(), v.null())) }, returns: resultDto,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const id = ctx.db.normalizeId('catchAttempts', args.attemptId);
    const attempt = id ? await ctx.db.get('catchAttempts', id) : null;
    if (!attempt || attempt.catcherId !== profile._id) throw new ConvexError('This attempt is unavailable.');
    if (attempt.outcome) return { outcome: attempt.outcome, hits: attempt.hits ?? [false, false, false], flightId: attempt.flightId };
    const stored = await ctx.db.get('flights', attempt.flightId);
    if (!stored) throw new ConvexError('This flight is unavailable.');
    const now = Date.now();
    const flight = await settleFlight(ctx, stored, now);
    if (flight.state === 'delivered') {
      await ctx.db.patch('catchAttempts', attempt._id, { outcome: 'delivered', hits: [false, false, false] });
      return { outcome: 'delivered' as const, hits: [false, false, false], flightId: flight._id };
    }
    if (now >= attempt.expiresAt || flight.state !== 'in_flight' || flight.activeAttemptId !== attempt._id) {
      await finishAttempt(ctx, flight, attempt, 'expired', [false, false, false], now);
      return { outcome: 'expired' as const, hits: [false, false, false], flightId: flight._id };
    }
    if (now < attempt.startedAt + 6000) throw new ConvexError('Finish all three rounds before submitting.');
    if (args.taps.length !== 3 || args.taps.some((tap, round) => tap !== null && (!Number.isFinite(tap) || tap < round * 2000 || tap >= (round + 1) * 2000))) throw new ConvexError('Submit one elapsed timestamp or a miss for each round.');
    const hits = args.taps.map((tap, round) => tap !== null && isHit(tap - round * 2000, attempt.phases[round]));
    const blocked = await areBlocked(ctx, profile._id, flight.senderId) || await areBlocked(ctx, profile._id, flight.recipientId);
    const caught = !blocked && hits.filter(Boolean).length >= (flight.defense === 'zigzag' ? 3 : 2);
    const outcome = caught ? 'caught' as const : 'missed' as const;
    await finishAttempt(ctx, flight, attempt, outcome, hits, now, args.taps);
    return { outcome, hits, flightId: flight._id };
  },
});

export const settle = internalMutation({
  args: { flightId: v.id('flights') }, returns: v.null(),
  handler: async (ctx, args) => {
    const flight = await ctx.db.get('flights', args.flightId);
    if (flight) await settleFlight(ctx, flight, Date.now());
    return null;
  },
});

export const closeCatchWindow = internalMutation({
  args: { flightId: v.id('flights') }, returns: v.null(),
  handler: async (ctx, args) => {
    const flight = await ctx.db.get('flights', args.flightId);
    if (flight?.state === 'in_flight') await ctx.db.patch('flights', flight._id, { catchOpen: false, updatedAt: Date.now() });
    return null;
  },
});

export const expireAttempt = internalMutation({
  args: { attemptId: v.id('catchAttempts') }, returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get('catchAttempts', args.attemptId);
    if (!attempt || attempt.outcome || attempt.expiresAt > Date.now()) return null;
    const stored = await ctx.db.get('flights', attempt.flightId);
    if (!stored) return null;
    const flight = await settleFlight(ctx, stored, Date.now());
    if (flight.state !== 'delivered') await finishAttempt(ctx, flight, attempt, 'expired', [false, false, false], Date.now());
    return null;
  },
});

export const clearCooldown = internalMutation({
  args: { profileId: v.id('profiles'), until: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get('profiles', args.profileId);
    if (profile?.catchCooldownUntil === args.until && Date.now() >= args.until) await ctx.db.patch('profiles', profile._id, { catchCoolingDown: false });
    return null;
  },
});
