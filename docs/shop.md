# Coop shop

The isolated React Native shop follows [Paper’s Shop page](https://app.paper.design/file/01M7GFFP9QE40C6END0X03AYCB/p-8-0), including its ownership and navigation notes. It does not replace the map, composer, mailbox, or interception routes. The editable source was read, not changed; SVG assets were extracted as vectors, not screenshots.

## Integration

`starter/shop/Shop.tsx` exports `Shop({ entry, gateway, onExit })`. `src/shop.ts` is the typed boundary. Construct and memoize `createConvexShopGateway(client, accountId)` for the authenticated account; its scope key isolates visits across accounts. The host must unmount the shop on sign-out and retain its existing draft controller while the shop is open. Entry changes reset the visit; late checkout responses cannot open a browser after departure.

- Home opens the coop. The host places its coop shortcut beside mail; its send dock remains a send action.
- `{from: 'compose', draftKey, selectedBirdId}` opens a picker roundtrip. Back returns the original selection with `confirmed: false`. Send with… returns only a ready bird with `confirmed: true`; it does not send a letter or change recipient, body, or anonymity.
- `{from: 'shop', ownedOnly?}` opens the catalog or My items. `{from: 'item', itemId, selectedBirdId}` opens a specific fitting room. An insufficient balance opens Get points and retains the item/bird until the person confirms again.
- `{from: 'sky'}` opens Stone shop and exits to the sky. There is no live stone-credit mutation in this slice.

The canonical `pigeons` table and `onboarding.ensureFlock` / `onboarding.flock` come from onboarding PR #5, now on main. Call the canonical ensure operation during host bootstrap for existing accounts; the shop never provisions birds. It validates ownership against the same IDs on every mutation. Active flights with a `pigeonId` reserve that bird; an older unassigned active flight conservatively marks availability as syncing. Messaging owns exact readiness/return projections and dispatch; the shop does not invent return ETAs.

The server snapshot contains actual balance, accessory ownership, wearer, revision, pending order and explicit capabilities. Missing config does not become a sample wallet. My items filters owned items. The same wearer data drives coop thumbnails and fitting rooms. One accessory moves atomically between owned, ready birds without buying it twice.

## Intentional limits

Paper’s prices, boost effects, extra pigeon, stone packs and weekly release cadence are proposals. Only the scarf has a proposed purchasable accessory price in the supplied fitting-room design. Sunday cap and goggles have no invented prices. All live shop purchasing/spending defaults off. Treat/guard activation, stone purchasing and extra-pigeon purchasing are unavailable in the real gateway; their interaction samples exist only in the marked test preview. No flight speeds, interception odds, subscriptions, pigeon provisioning or stone pouch state are changed.

Native paid goods and checkout are disabled, including externally purchased accessory display in the native gateway, until a distribution/storefront decision is approved. This is not global App Store/Play compliance. Whop’s [iOS overview](https://docs.whop.com/developer/guides/ios/overview.md) uses Whop in the US and StoreKit elsewhere; that fallback conflicts with Whop-only worldwide payments. [Apple’s digital-goods and cross-platform rules](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase) and [Google’s payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en) / [US external links program](https://support.google.com/googleplay/android-developer/answer/16470497?hl=en) need separate storefront eligibility and enrollment work. Expo Go has no Whop native billing bridge here; none was added.

## Server payment boundary

The existing `commerceOrders`, durable `commerceEvents` inbox, payment binding and raw signature verifier are reused. New points packs extend that pipeline, not a second payments store. `commerceWallets`, append-only `commerceLedger`, and `commerceAccessories` live in the already registered commerce schema. No new flock, stone or gameplay tables are introduced.

All provider requests use `https://sandbox-api.whop.com/api/v1` with `Api-Version-Date: 2026-11-14-1`. Checkout uses the current `variant_id` API, not the legacy `plan_id` shape. The server persists authenticated profile/user, opaque intent/request key, catalog revision, expected account/product/variant, USD base cents and points before requesting checkout. It retrieves the full variant and validates product, price, one-time billing, quantity one, exclusive tax, visible/buy-now and no adaptive pricing/expiry. Only a validated `https://sandbox.whop.com/checkout/...` URL is exposed.

Raw signed webhooks are durably ingested before acknowledgement. Fresh server-side payment lookup must match account, environment, checkout, intent, product, variant, one line item, quantity, subtotal, currency and tax/total. A client return URL, browser dismissal or `authorized` payment never credits points. Exact event IDs include a payload hash, payments bind to one order, and unique ledger keys prevent replay credits. Spend, grant and equip share one Convex transaction; a stale revision or wearer requires a new confirmation.

Pending, paid, canceled, failed, disputed, refunded and reconciliation remain distinct for points orders. Pending checkout is restored from the server. Failed/canceled retries use a new key only after the terminal state; ambiguous mutations reuse the exact original key/payload. Creating a checkout is not success. Old asynchronous reads cannot replace a newer payment confirmation.

Whop configurations are reusable links, not single-charge intents. After a terminal verified points result the worker deletes the hosted configuration with bounded durable retries, without delaying credit. An in-flight payment can still complete; a second distinct charge is reconciled, never credited twice for the same local order. Each points order independently schedules expiry/closure after 23 hours, before the provider’s 24-hour idempotency retention expires. An abandoned client cannot leave expiry dependent on another visit. Creation retries also enforce that deadline. A payment racing checkout attachment retries and then enters reconciliation rather than granting without a binding. Pending orders reject competing keys and expose their original key only to their authenticated owner for exact resume.

Full refunds or lost/prevented disputes reverse the original credited pack exactly once: Whop explicitly defines `prevented` as settling like `lost`. If those points were spent, the ledger records debt, the displayed spendable balance floors at zero, and accessories/spending pause. Open disputes suspend spending; only a fresh won/closed-warning dispute lookup clears that hold, and can issue a previously withheld original credit exactly once. Ordinary payment events cannot clear dispute holds. Each asynchronous verification captures an order version before its authoritative fetch and must retry if another verification changed the order. Partial refunds or inconsistent refund evidence are held for reconciliation without inventing a proration policy, and stale successes cannot clear that hold. A stale failure/cancel notification cannot terminate a currently pending charge. The retained legacy Aviator reversal semantics remain separate and unchanged.

## Configuration and verification

Nothing in this change configures, deploys, provisions, charges or contacts an authenticated merchant account. Configuration presence is explicitly not evidence of a working sandbox integration. A future authorized sandbox acceptance test needs server-only sandbox API key, signing secret, account, HTTPS return origin, approved product/variant mappings, and a webhook configured for the exact pinned version. Never put these credentials in `EXPO_PUBLIC_*`.

Server settings are `WHOP_SANDBOX_API_KEY`, `WHOP_SANDBOX_WEBHOOK_SECRET`, `WHOP_SANDBOX_ACCOUNT_ID`, `PIGEON_PUBLIC_ORIGIN`, `PIGEON_SHOP_CHANNEL=standalone-web-sandbox`, and `PIGEON_SHOP_SANDBOX_CATALOG`. The legacy Aviator path alone also needs `WHOP_SANDBOX_VARIANT_ID`. The catalog is an approval-controlled JSON object with `revision`, `packs: [{sku,productId,variantId,cents,points}]`, and optional `cloudScarfPoints: 60`. Supported proposed packs are 100/$1, 550/$5, 1,200/$10; mismatches fail closed. Do not set this configuration merely to make UI buttons active. Only explicitly approved sandbox SKUs belong in it.

The sandbox credential needs checkout create/read/delete, variant read (`plan:basic:read` in Whop’s current scope names), payment read and dispute read. Webhooks include payment success/failure/cancel, refund create/update and dispute create/update. Refund webhook resources still have the documented legacy nested `payment.id`, while Payment and Dispute use the current API shapes. No refund execution permission is needed or exercised by this code.

Operational recovery stays privileged: inspect `commerceEvents` in reconciliation, and replay only transient lookup/attachment/version-conflict failures via internal `commerceData.replayVerification`. Business mismatches and partial-refund holds require a human decision; there is no public replay, mint-points or clear-debt endpoint. Failed configuration deletion is visible through `closeAttempts`/`checkoutClosed` on the order; internal `commerceData.retryCheckoutClosure` starts a new bounded cleanup attempt after an operator fixes access. Do not mark it closed without provider evidence. Duplicate-charge reconciliation may require a merchant refund outside this app, with explicit authorization.

Primary sources: [sandbox](https://docs.whop.com/developer/guides/sandbox.md), [auth scoping](https://docs.whop.com/developer/guides/auth-scoping.md), [webhooks](https://docs.whop.com/developer/guides/webhooks.md), [idempotency](https://docs.whop.com/developer/api/idempotency.md), [refunds/disputes](https://docs.whop.com/developer/guides/refunds-and-disputes.md), [checkout deletion](https://docs.whop.com/api-reference/checkout-configurations/delete-a-checkout-configuration.md), [current OpenAPI](https://api.whop.com/api/v1/openapi.json). Checked November 15, 2026, with the published SDK 2.8.1 webhook helper. Its default REST API pin differs, so this implementation retains explicit REST versioning.

## Run the marked preview

```sh
npm ci
npm --prefix starter ci
cd starter/shop/preview
npx expo start --web --port 8083
```

The preview is separate from `starter/App.tsx`. Open `/` for the mock home/composer roundtrip, or `?screen=catalog`, `?screen=coop`, `?screen=scarf`, `?screen=owned`, `?screen=stones`, `?screen=setup`. Add `&balance=low` to test an insufficient balance. Every fixture screen is marked TEST PREVIEW; simulated payment outcomes never call Whop or mint server credits. The setup variant has no sample account balance/ownership. No native build or real sandbox payment has been verified.

`npm run check` runs existing and new backend/component/model tests and both typechecks. Targeted tests cover concurrency, replay, signatures through the retained verifier, product/price binding, refunds/debt/dispute order, attachment/expiry recovery, navigation, selection, retry, asynchronous lifecycle and native gates. Browser checks at 390px and 320px verify actual layout and the fixture interaction, not native or provider acceptance.
