# Whop store setup

The connected Coop shop opens a server-created Whop checkout for 100 points ($1), 550 points ($5), and 1,200 points ($10). The bonus points are included in the server grant. Additional pigeons cost $5.00 USD, as agreed, and use the same payment flow once their matching variant is configured. `PIGEON_PRICE_CENTS` defaults to `500` when unset; an explicit empty/invalid value disables that product.

The local onboarding/design preview still uses sample inventory. For real account purchases, run the connected app with `EXPO_PUBLIC_ONBOARDING_PREVIEW=false`, `EXPO_PUBLIC_DESIGN_PREVIEW=false`, and its correct `EXPO_PUBLIC_CONVEX_URL`. Checkout stays unavailable until its server configuration is complete.

## Credentials needed for the connected test

Start with an Account API key from the [Whop sandbox developer dashboard](https://sandbox.whop.com/dashboard/developer). Use a key for the account selling the products, with access to create checkout configurations and read payments. Variant reads also run before checkout to verify product settings. Whop documents the [sandbox hosts and key setup](https://docs.whop.com/developer/guides/sandbox).

Also supply the account ID (`biz_…`), the product variant IDs (`plan_…`), the webhook signing secret (`ws_…`), and the public HTTPS origin of the connected web app. The API key alone does not enable checkout.

Keep keys in the Convex environment. Do not put them in `EXPO_PUBLIC_*` variables, source control, screenshots, or chat. Once this checkout is linked to the intended Convex deployment, these commands prompt for the values:

```sh
npx convex env set WHOP_SANDBOX_API_KEY
npx convex env set WHOP_SANDBOX_WEBHOOK_SECRET
```

The deployment's Environment Variables dashboard also accepts them. `.env.example` lists all settings; creating a local `.env` file alone does not configure the cloud backend. No deployment or Whop account configuration has been performed by this code change. Local `convex codegen` also requires a selected deployment; regenerate its types after linking the intended project.

## Products and checkout

Create a one-time USD variant for each enabled product. Configure exclusive tax, turn adaptive pricing off, and allow only a single quantity. Do not attach discounts to these store variants: fulfillment validates the exact base price and total plus tax. Match these values:

| Product | Price | Convex setting for its variant ID |
| --- | --- | --- |
| 100 points | $1.00 | `WHOP_SANDBOX_POINTS_100_VARIANT_ID` |
| 550 points | $5.00 | `WHOP_SANDBOX_POINTS_550_VARIANT_ID` |
| 1,200 points | $10.00 | `WHOP_SANDBOX_POINTS_1200_VARIANT_ID` |
| Additional pigeon | $5.00 (`PIGEON_PRICE_CENTS=500`) | `WHOP_SANDBOX_PIGEON_VARIANT_ID` |
| Legacy Aviator pack | $2.99 | `WHOP_SANDBOX_VARIANT_ID` (optional) |

Set `WHOP_ENVIRONMENT=sandbox`, `WHOP_SANDBOX_ACCOUNT_ID`, and `PIGEON_PUBLIC_ORIGIN` (an HTTPS origin with no path, query, or fragment). Only fully configured products become purchasable. Requests use the [current checkout API](https://docs.whop.com/api-reference/checkout-configurations/create-a-checkout-configuration) and [variant API](https://docs.whop.com/api-reference/variants/retrieve-variant), pinned to `2026-11-14-1`.

The browser returns to `PIGEON_PUBLIC_ORIGIN/?checkout_order=ORDER_ID`. The authenticated app opens the shop and reads the order's server status. In Expo Go, return to the app after payment; its wallet and purchase status update through Convex. A return URL never grants inventory. The Whop checkout displays applicable tax and buyer fees.

## Webhook

Register a publicly reachable webhook at:

```text
https://YOUR-DEPLOYMENT.convex.site/webhooks/whop/sandbox
```

Use `api_version: v1` and `api_version_date: 2026-11-14-1`. Subscribe to `payment.succeeded`, `payment.failed`, `payment.canceled`, `refund.created`, `refund.updated`, `dispute.created`, and `dispute.updated`. Save its signing secret in `WHOP_SANDBOX_WEBHOOK_SECRET`. The [Whop webhook guide](https://docs.whop.com/developer/guides/webhooks) describes signature verification and endpoint creation; the [API version guide](https://docs.whop.com/developer/api/versioning) describes the date pin.

The handler verifies the raw signature, stores the event before acknowledgment, and schedules a fresh payment lookup. It checks account, environment, order, checkout, variant, currency, quantity, price, and tax before delivering anything. Duplicate events and payment IDs cannot credit points or create pigeons twice. A failed lookup retries five times, then marks the event and applicable pending order for support review.

For support review, inspect `commerceEvents.reason` and the associated `commerceOrders` record. Do not ask the buyer to pay again or manually mark an order paid without reconciling the payment in Whop. A second distinct payment on an already-paid checkout is flagged for review instead of granting again.

Refunds and unresolved disputes revoke the purchase. A partial refund conservatively revokes the whole pack. Points are deducted only once; already-spent points remain as a negative balance that later earnings/top-ups repay. A refunded pigeon is hidden from the flock and cannot launch or use accessories; existing flight records remain intact. Stale success events cannot undo a reversal. The legacy Aviator entitlement remains supported.

## Verification and production

Run `npm run check` for the backend, shop controls, return handling, and existing app regressions. These tests use mocked Whop responses; they do not prove live credentials or delivery from Whop.

After deploying the connected app and backend, complete a sandbox card purchase, verify that its points appear once, resend the webhook, then refund it and verify the balance reversal. Exercise a declined payment and a return before the webhook arrives. Confirm ownership from a separate signed-in account cannot be read or changed. Test the $5 pigeon variant and its refund as well.

Use separate Convex deployments and player data for sandbox and production because the wallet is shared within a deployment. Set the `WHOP_LIVE_*` equivalents on production, register `/webhooks/whop/production` there, and explicitly set `WHOP_ENVIRONMENT=production`. Keep the same version pin and product settings. The generic legacy endpoint `/webhooks/whop` follows the active environment; explicit endpoints preserve the environment on queued events even if the active setting changes.

Payment checks, schema, UI, and configuration should be deployed together. A real Whop sandbox transaction and a deployment remain outstanding until credentials and hosting are configured.
