import type { Order } from '../src/domain';
import { pointPacks } from '../src/shop';

export function checkoutReturnId(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get('checkout_order') ?? (parsed.pathname === '/checkout-return' ? parsed.searchParams.get('order') : null);
    return id && /^[A-Za-z0-9_-]{8,128}$/.test(id) ? id : null;
  } catch { return null; }
}

export function purchaseStatus(order: Order): string {
  const pack = pointPacks.find(pack => pack.sku === order.sku);
  const item = pack ? `${pack.points.toLocaleString('en-US')} points` : order.sku === 'pigeon' ? 'Your new pigeon' : 'Aviator Pack';
  switch (order.status) {
    case 'pending': return `${item}: waiting for payment confirmation. If you already paid, your purchase will appear automatically.`;
    case 'paid': return `${item}: added to your ${pack ? 'balance' : 'flock'}.`;
    case 'failed': return `${item}: payment was not completed. You can try again.`;
    case 'refunded': return `${item}: payment was reversed and the purchase was removed.`;
    case 'reconciliation': return `${item}: payment needs review. Contact support with order ${order.id} before paying again.`;
  }
}
