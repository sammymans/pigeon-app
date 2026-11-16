import { ConvexError, v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { normalizePhone, phoneConfig, twilioVerify } from './phoneProtocol';

export const consumeLimit = internalMutation({
  args: { phone: v.string(), kind: v.union(v.literal('send'), v.literal('verify')) },
  handler: async (ctx, { phone, kind }) => {
    const now = Date.now();
    const policies = kind === 'send'
      ? [{ key: `send:${phone}`, duration: 3600_000, maximum: 5, cooldown: 60_000 }, { key: 'send:global', duration: 86400_000, maximum: 100, cooldown: 0 }]
      : [{ key: `verify:${phone}`, duration: 600_000, maximum: 5, cooldown: 0 }, { key: 'verify:global', duration: 86400_000, maximum: 500, cooldown: 0 }];
    for (const policy of policies) {
      const row = await ctx.db.query('phoneLimits').withIndex('by_key', q => q.eq('key', policy.key)).unique();
      const fresh = !row || now >= row.windowStart + policy.duration;
      if (row && ((!fresh && row.count >= policy.maximum) || now < row.retryAt)) {
        throw new ConvexError('Too many attempts. Please wait before trying again.');
      }
      const value = { key: policy.key, windowStart: fresh ? now : row!.windowStart, count: fresh ? 1 : row!.count + 1, retryAt: now + policy.cooldown };
      if (row) await ctx.db.replace('phoneLimits', row._id, value);
      else await ctx.db.insert('phoneLimits', value);
    }
    return { retryAt: now + 60_000 };
  },
});

export const sendCode = action({
  args: { phone: v.string() }, returns: v.object({ retryAt: v.number() }),
  handler: async (ctx, args): Promise<{ retryAt: number }> => {
    const phone = normalizePhone(args.phone);
    phoneConfig();
    const limit = await ctx.runMutation(internal.phoneAuth.consumeLimit, { phone, kind: 'send' });
    const result = await twilioVerify('Verifications', { To: phone, Channel: 'sms' });
    if (result.status !== 'pending' || result.to !== phone) throw new ConvexError('Could not send the code. Please try again later.');
    return limit;
  },
});
