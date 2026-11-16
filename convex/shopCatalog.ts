import { env } from './_generated/server';
import { proposedPacks, type PackId } from '../src/shop';
import { record } from './whopProtocol';

export function approvedShopCatalog() {
  if (env.PIGEON_SHOP_CHANNEL !== 'standalone-web-sandbox') return null;
  try {
    const value = record(JSON.parse(env.PIGEON_SHOP_SANDBOX_CATALOG ?? ''));
    if (typeof value.revision !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value.revision) || !Array.isArray(value.packs) || value.packs.length > 3) return null;
    const packs: { sku: PackId; productId: string; variantId: string; cents: number; points: number }[] = [];
    for (const raw of value.packs) {
      const pack = record(raw);
      const proposal = proposedPacks.find(p => p.id === pack.sku);
      if (!proposal || typeof pack.productId !== 'string' || !/^prod_[A-Za-z0-9]+$/.test(pack.productId) || typeof pack.variantId !== 'string' || !/^plan_[A-Za-z0-9]+$/.test(pack.variantId) || pack.cents !== proposal.dollars * 100 || pack.points !== proposal.points) return null;
      if (packs.some(p => p.sku === proposal.id || p.variantId === pack.variantId)) return null;
      packs.push({ sku: proposal.id, productId: pack.productId, variantId: pack.variantId, cents: pack.cents, points: pack.points });
    }
    return { revision: value.revision, packs, scarfApproved: value.cloudScarfPoints === 60 };
  } catch { return null; }
}
