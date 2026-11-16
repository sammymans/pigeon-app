import { ConvexError, v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { requireProfile } from './model';
import { orderValidator, outfitValidator, skuValidator } from './commerceSchema';
import { orderDto } from './commerceData';
import { activeEnvironment, productConfig, productFor, record, requireProductConfig, whopRequest } from './whopProtocol';
import { pointPacks } from '../src/shop';
import type { Order, Outfit } from '../src/domain';

export const catalog = query({
  args: {},
  returns: v.object({ configured: v.boolean(), priceLabel: v.string(), testMode: v.boolean() }),
  handler: async () => ({ configured: productConfig('aviator') !== null, priceLabel: '$2.99 USD · one time', testMode: activeEnvironment() !== 'production' }),
});

export const storefront = query({
  args: {},
  returns: v.object({ testMode: v.boolean(), products: v.array(v.object({
    sku: skuValidator, title: v.string(), cents: v.number(), points: v.number(), configured: v.boolean(),
  })) }),
  handler: async () => ({
    testMode: activeEnvironment() !== 'production',
    products: [...pointPacks.map(pack => pack.sku), 'pigeon' as const].map(sku => ({ sku, ...productFor(sku), configured: productConfig(sku) !== null })),
  }),
});

export const orders = query({
  args: {}, returns: v.array(orderValidator),
  handler: async ctx => {
    const profile = await requireProfile(ctx);
    const orders = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_createdAt', q => q.eq('profileId', profile._id)).order('desc').take(30);
    return orders.filter(order => order.sku !== 'aviator' && order.environment === activeEnvironment()).map(orderDto);
  },
});

export const ownership = query({
  args: {},
  returns: v.object({ owned: v.array(outfitValidator), equipped: outfitValidator, orders: v.array(orderValidator) }),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const entitlement = await ctx.db.query('commerceEntitlements').withIndex('by_profileId_and_sku', (q) => q.eq('profileId', profile._id).eq('sku', 'aviator')).unique();
    const orders = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_createdAt', (q) => q.eq('profileId', profile._id)).order('desc').take(30);
    const owned: Outfit[] = entitlement?.active ? ['classic', 'aviator'] : ['classic'];
    return { owned, equipped: owned.includes(profile.equipped) ? profile.equipped : 'classic' as const, orders: orders.map(orderDto) };
  },
});

export const order = query({
  args: { id: v.string() }, returns: v.union(orderValidator, v.null()),
  handler: async (ctx, { id }) => {
    const profile = await requireProfile(ctx);
    const found = await ctx.db.query('commerceOrders').withIndex('by_intentId', (q) => q.eq('intentId', id)).unique();
    return found?.profileId === profile._id ? orderDto(found) : null;
  },
});

export const equip = mutation({
  args: { outfit: outfitValidator }, returns: v.null(),
  handler: async (ctx, { outfit }) => {
    const profile = await requireProfile(ctx);
    if (outfit === 'aviator') {
      const entitlement = await ctx.db.query('commerceEntitlements').withIndex('by_profileId_and_sku', (q) => q.eq('profileId', profile._id).eq('sku', 'aviator')).unique();
      if (!entitlement?.active) throw new ConvexError('A verified Aviator purchase is required before equipping.');
    }
    await ctx.db.patch('profiles', profile._id, { equipped: outfit });
    return null;
  },
});

export const checkout = action({
  args: { sku: skuValidator, requestKey: v.string() }, returns: orderValidator,
  handler: async (ctx, { sku, requestKey }): Promise<Order> => {
    const order: Doc<'commerceOrders'> = await ctx.runMutation(internal.commerceData.beginCheckout, { sku, requestKey, intentId: crypto.randomUUID() });
    if (order.purchaseUrl || order.status !== 'pending') return orderDto(order);
    const config = requireProductConfig(sku);
    if (order.environment !== config.environment || order.accountId !== config.accountId || order.variantId !== config.variantId) throw new ConvexError('This order belongs to an earlier checkout configuration. Contact support.');
    const variant = record(await whopRequest(`/variants/${encodeURIComponent(order.variantId)}`, config.apiKey, undefined, undefined, config.environment));
    if (variant.id !== order.variantId || record(variant.account).id !== order.accountId || variant.billing_type !== 'one_time' || variant.initial_price !== order.baseCents / 100 || variant.currency !== 'usd' || variant.tax_type !== order.taxBasis || variant.adaptive_pricing_enabled !== false || variant.allow_multiple_quantity !== false) {
      throw new ConvexError('The Whop product does not match the store price or settings. Please contact support.');
    }
    const checkout = record(await whopRequest('/checkout_configurations', config.apiKey, {
      account_id: order.accountId, variant_id: order.variantId, mode: 'payment',
      metadata: { order_id: order.intentId, environment: order.environment },
      redirect_url: order.redirectUrl,
      payment_method_configuration: { enabled: ['card'], disabled: [], include_platform_defaults: false },
    }, `pigeon-${order.intentId}`, config.environment));
    const checkoutVariant = record(checkout.variant);
    const metadata = record(checkout.metadata);
    if (typeof checkout.id !== 'string' || !/^ch_[A-Za-z0-9]+$/.test(checkout.id) || checkout.account_id !== order.accountId || checkout.mode !== 'payment' || checkoutVariant.id !== order.variantId || checkoutVariant.billing_type !== 'one_time' || checkoutVariant.initial_price !== order.baseCents / 100 || checkoutVariant.currency !== 'usd' || checkoutVariant.adaptive_pricing_enabled !== false || metadata.order_id !== order.intentId || metadata.environment !== order.environment || checkout.redirect_url !== order.redirectUrl || typeof checkout.purchase_url !== 'string') {
      throw new ConvexError('Whop returned an unexpected checkout configuration. No purchase was delivered.');
    }
    const url = new URL(checkout.purchase_url);
    if (url.protocol !== 'https:' || url.hostname !== (config.environment === 'sandbox' ? 'sandbox.whop.com' : 'whop.com') || url.username || url.password || url.port) throw new ConvexError(`Whop did not return a ${config.environment} checkout URL.`);
    return await ctx.runMutation(internal.commerceData.attachCheckout, { id: order._id, checkoutId: checkout.id, purchaseUrl: url.href });
  },
});
