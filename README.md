# Pigeon

Send a thought. Watch it cross the world. Hope it gets there.

An Expo / React Native / TypeScript app with Expo Router and a shared web sky. Convex owns authenticated profiles, private letters, city-to-city flights, arrival, catch reservations, connections, moderation, and cosmetic ownership. Whop provides sandbox-only hosted checkout for the Aviator Pack.

## Run it

```sh
npm ci
npm run dev
npm run web
```

Without a configured deployment, the app renders an explicitly unconnected post office and disables writes. There is no mocked payment, account, message, or successful catch fallback. For an isolated local Convex deployment use `CONVEX_AGENT_MODE=anonymous npm run dev`; keep that process running. Local state and generated credentials stay in ignored `.convex/` and `.env.local`, excluded from native uploads.

Set `EXPO_PUBLIC_CONVEX_URL` to the deployment's public API URL and `EXPO_PUBLIC_WEB_ORIGIN` to the actual HTTPS web origin. A loopback URL only works on the backend's machine; phones need a cloud endpoint or an explicitly temporary development tunnel. The web export is a single-page app: serve `dist/` with an `index.html` fallback for deep links.

```sh
npm run test
npm run lint
npm run build:web
```

## Authentication and demo accounts

Convex Auth is pinned to `0.0.98`, whose Password/authTables API the app uses. The backend needs `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` in **Convex deployment environment variables**. Generate an extractable RS256 key pair with `jose`; store the PKCS8 private key with newlines replaced by spaces, and the public JWK as `{"keys":[{"use":"sig",...publicJwk}]}`. Never print, commit, or put the private key in an `EXPO_PUBLIC_*` variable. The `/.well-known` auth endpoints are mounted by `auth.addHttpRoutes`.

For immediate play, choose **Try the isolated demo** on Sky or sign-in. The real Anonymous auth provider issues a persisted session, then `demo.start` creates a fresh private namespace with explicitly fictional sample pen pals. A 30-second Sealed hello, two catchable flights, and one sample friendship let a visitor read, send, and catch without a password. It cannot convert a real account, force a win, grant cosmetics, or silently accept a catch request. **Reset demo flights** explicitly replaces only that namespace's fixtures; nothing is automatically reseeded when timers expire. Signing out loses this temporary account unless its session is otherwise retained.

For a permanent account, sign up normally, then choose a unique handle and home city. Existing friends establish a mutual connection only after an invite is explicitly accepted. Written letters require an accepted connection and always travel by pigeon.

For a repeatable **isolated demo**, sign up three fresh real accounts, complete their profiles, then invoke the trusted internal `demo.provision` mutation with `{namespace:'judges',userIds:[A,B,C]}`. These are authentication user IDs, not profile IDs. This operation requires operator deployment access and is not callable from the app. It refuses existing live accounts with flight or connection history.

The prepared accounts expose Seed and Reset in Nest. Seed establishes A/B as friends, C as a potential catcher, and three clearly labeled demo flights. Reset clears only that namespace's flights and social fixtures; it retains authenticated accounts and verified commerce. Normal and demo flights use separate queries/counts. `/sky?demo=1` is the anonymous read-only demo sky; `/sky` starts with normal flights. Do not represent demo fixtures as live traffic.

## Privacy and game rules

- Sealed is the default. Only its sender and intended recipient can see the flight; the recipient cannot read before server-confirmed delivery. This is access control, not end-to-end encryption.
- Every Open Skies letter requires an unchecked disclosure acknowledgment. Public DTOs and share tokens contain routes, outfits, timestamps and state, never letter bodies or participant identities.
- Normal seconds are `max(120, ceil(distanceKm / 60 * 3600))`. Demo seconds are `clamp(ceil(distanceKm / 60), 30, 90)`. Zigzag adds 20%. The server snapshots city endpoints and timestamps; clients interpolate a monotonic clock aligned to the server.
- Three active flights maximum, transactionally enforced. Launch keys survive retries and reloads. A draft can be explicitly recovered without losing its text after a rejected/ambiguous attempt.
- Catching is three two-second rounds with a central 24% net and the specified sine motion. Cruise requires two hits; Zigzag three. Ten-second leases, two attempts per flight, one per catcher, a 30-second cooldown and the final 15-second cutoff are server-enforced. Arrival wins; outcomes are immutable. This is reproducible demo-grade validation, not competitive anti-cheat.
- A successful catcher may send only the fixed connection request. Accept/decline/block are explicit; reports persist privately for operator review.

## Whop sandbox

All server configuration belongs in Convex, never in Expo's public environment:

| Variable | Purpose |
| --- | --- |
| `WHOP_SANDBOX_API_KEY` | Sandbox account API credential |
| `WHOP_SANDBOX_WEBHOOK_SECRET` | Signing secret generated for this webhook |
| `WHOP_SANDBOX_ACCOUNT_ID` | Authorized sandbox merchant account |
| `WHOP_SANDBOX_VARIANT_ID` | Pigeon Aviator one-time variant |
| `PIGEON_PUBLIC_ORIGIN` | Actual HTTPS web origin, with `/checkout-return` |

The variant must be USD 2.99 one-time, quantity one, adaptive pricing disabled and `override_tax_type: 'exclusive'`. The configured checkout total handles tax separately. Use current Whop API version `2026-11-14-1`, not older plan-shaped examples. The API key needs checkout creation/read, variant read, and payment read capabilities; catalog/webhook provisioning needs its respective account permissions too.

Register `POST https://<deployment>.convex.site/webhooks/whop` for `payment.succeeded`, `payment.failed`, `payment.canceled`, `refund.created`, `refund.updated`, `dispute.created`, and `dispute.updated`, with the exact API version above. The official SDK verifies the raw body. A durable inbox is written before acknowledging, then a scheduled worker reads the actual payment from **sandbox-api.whop.com**, checks account/order/checkout/variant/currency/price/tax, and atomically fulfills once. Unknown or mismatched records go to reconciliation. A return URL never grants ownership.

Ownership is reactive and persistent. Equip updates active and future public birds. Refunds/disputes conservatively revoke the outfit, reverting to Classic; reconciliation and partial reversals need operator review. This is not certification for production sales or App Store payment compliance. No production endpoint or live-money toggle is provided.

## Rive and native validation

Original pigeon art and editable Rive source are in `assets/pigeon/` and `assets/rive/`. Platform-specific adapters use `@rive-app/react-native` 0.5.14 with Nitro 0.36.5 on native and `@rive-app/react-webgl2` 4.39.0 on web. They bind each bird's own `PigeonMotion.Default` number property `motion`, never legacy state-machine inputs or game callbacks. See [the runtime contract](docs/rive.md).

At this checkpoint the Rive export is **blocked on the free account sign-in**: no `.riv` binary has been supplied. The original transparent static art is rendered honestly instead. `EXPO_PUBLIC_PIGEON_RIVE_URL` can point to the genuine published asset after export; runtime playback must then be validated separately. Do not rename a preview/image to `.riv` or call preview video runtime integration.

Rive's native module requires a development/native build, not Expo Go. Expo Go receives the static fallback. Reduced motion uses the original static outcome poses; the essential catch lane remains a clearly disclosed timing game and can be skipped. No Rive motion changes hit geometry or server outcomes.

Use the platform's Revyl build runner for an iOS simulator binary. A web render or iOS JavaScript export is not native validation. A simulator artifact also is not a signed physical-phone install: the latter needs Apple signing/device provisioning. Current verification and external blockers are recorded in [acceptance](docs/acceptance.md).
