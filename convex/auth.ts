import { Password } from '@convex-dev/auth/providers/Password';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { convexAuth, createAccount } from '@convex-dev/auth/server';
import { ConvexCredentials } from '@convex-dev/auth/providers/ConvexCredentials';
import { ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import { normalizePhone, phoneConfig, twilioVerify } from './phoneProtocol';

const Phone = ConvexCredentials({
  id: 'phone',
  authorize: async (params, ctx) => {
    const phone = normalizePhone(params.phone);
    phoneConfig();
    await ctx.runMutation(internal.phoneAuth.consumeLimit, { phone, kind: 'verify' });
    if (typeof params.code !== 'string' || !/^\d{6}$/.test(params.code)) throw new ConvexError('Enter the six-digit code.');
    const result = await twilioVerify('VerificationCheck', { To: phone, Code: params.code });
    if (result.status !== 'approved' || result.to !== phone) throw new ConvexError('Invalid or expired code. Please try again.');
    const { user } = await createAccount(ctx, {
      provider: 'phone', account: { id: phone }, profile: { phone, phoneVerificationTime: Date.now() }, shouldLinkViaPhone: true,
    });
    return { userId: user._id };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({ providers: [Password, Anonymous, Phone] });
