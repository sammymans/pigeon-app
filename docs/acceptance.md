# P0 acceptance checkpoint

Verified 2026-11-15 against an isolated real local Convex deployment, exposed through temporary HTTPS/WSS development tunnels. **The app is playable on the web, but full P0 is not signed off:** a real Whop sandbox payment and native-device validation remain blocked by external access. The added genuine Rive runtime requirement also awaits its binary export.

## Evidence

- `npm test`: **74/74 passed** across seven suites: 23 backend, 33 commerce, 13 UI timing/draft/geometry, three domain, two cosmetic-state tests.
- `npm run lint`: both TypeScript projects and Convex ESLint passed.
- `npm run build:web`: shared Expo web export passed.
- iOS Hermes JavaScript export: passed. This is **not** an iOS binary build or native runtime proof.
- Three real Password-authenticated sessions: provisioned isolated accounts; checked recipient/anonymous denial before arrival; retried launch with one ID; rejected a fourth active flight; resolved a deterministic test catch once; verified the recipient lost access and the catcher gained it; accepted the fixed request; reopened a separate authenticated client after scheduled delivery and read the Sealed body. This used actual Convex transactions, not mocked identities.
- Real HTTPS browser: sign-in, public demo sky and public flight privacy, Sealed-default compose, disconnection disabling launch, retained draft after reload, successful launch and sender copy, disabled unconfigured checkout, and no browser page errors.
- Fresh no-password entry: clicked **Try the isolated demo**, received a real Anonymous auth session and isolated fixtures; explicit reset → World bird → Track → Try to catch → six-second game → server-confirmed miss was exercised. No result was forced.
- Independent reviewer checked privacy, auth, concurrency, consent, commerce bindings, routes, self-service demo isolation and network gating. The anonymous `undefined === undefined` role leak, direct demo-route reset, and retained-draft recovery issues were fixed and rechecked.

## Contract matrix

| Contract | Status | Verified scope / remaining proof |
| --- | --- | --- |
| Persistent authenticated identity, handle and chosen city | Passed on web/local backend | Real Password and Anonymous sessions; profile ownership/unique handles; native secure-store relaunch still needs device testing. |
| City snapshots and exact normal/demo/Zigzag duration formulas | Passed | Shared domain tests, backend timestamp assertions, real 90-second delivery; device-clock changes cannot author ETA. |
| Three-flight cap, draft preservation, idempotent launch | Passed | Concurrent backend tests, real API retry/cap, browser offline/reload/send flow and explicit retained-draft recovery. |
| Sealed default, Open Skies per-flight acknowledgment | Passed | Server rejects missing acknowledgment; UI counter/default/checkbox and privacy copy are implemented. |
| Private body authorization | Passed | Sender; delivered recipient only; intercepted catcher only; public/token/unauthorized callers denied by backend, not just hidden UI. |
| Animated shared Sky and selection/countdown | Passed on web | Mobile and desktop renders; markers capped at 30, accurate live total, cohort separation, single selected route, real bird interaction. |
| Six-second, three-round catch and free defense | Passed locally/web | Exact phase motion and net window tests; real UI miss; server hit thresholds and deterministic success tested. |
| Leases, per-flight/per-catcher limits, cooldown, arrival priority | Passed locally | Convex transaction/scheduler tests, immutable repeated resolution, actual lease-based catch against running backend. |
| Requests, accept/decline, invite consent, block/report | Passed backend | Fixed request only; no stranger free-text path; real request acceptance; negative authorization and block/decline/invite tests. Native sharing sheet remains unverified. |
| Whop verified payment → entitlement → equip → reactive public outfit | Blocked end-to-end | 33 tests pass, including real signature helper and mounted HTTP handler with mocked Whop API responses, duplicate/reversal/order/price/tax cases, and active-flight outfit projection. No hosted sandbox card payment has been completed. |
| Public read-only sky, flight links, native share/invite links | Passed web/backend; blocked native share proof | No bodies or participant identities in public payloads; HTTPS share origin; `/sky?demo=1`; native Share adapter implemented but not device-tested. |
| Isolated labeled fixtures, seed and reset | Passed | Explicit one-click real temporary auth; fictional pen pals, exact accelerated timers, personal namespace, manual reset only, no fake ownership/payment/forced wins. |
| Network recovery | Passed web; native proof pending | NetInfo plus browser online/offline and Convex connection state gate actions; last-known queries and saved draft persist. |
| Genuine Rive playback | Blocked | Original RML and transparent fallback art are included; correct per-instance numeric data-binding adapters are prepared. No `.riv` export exists yet, so no runtime playback is claimed. |
| iOS binary / simulator / physical iPhone | Blocked | Revyl refused before upload pending organization approval. Expo Go is an explicit static-art core fallback; physical iOS requires matching CLI/Expo Go account sign-in. Source handoff and a public SDK58 Metro manifest are provided, not native proof. |
| Repository PR / CI | Blocked | Remote repository has no refs and connected GitHub identity lacks write permission. Initial base publication remains owned by infrastructure; no base was created or merged by this workstream. |

## Operator actions still needed

1. Restore repository write access and publish the intended initial base, then open the product PR. No merge is authorized.
2. Approve the Revyl organization connection and validate a simulator build. Separately, sign Expo CLI and physical-iPhone Expo Go into the same account for the temporary core demo, or provide Apple signing for a standalone install.
3. Supply rotated secrets only through secure entry. Configure a verified non-production Convex deployment before migrating away from the current working temporary backend.
4. Supply a rotated **Whop sandbox** API key with the required account/catalog/checkout/payment/webhook capabilities. Derive/provision the Pigeon variant and webhook server-side; complete a real sandbox card checkout and verify its entitlement and second-session outfit update.
5. Finish the free Rive sign-in/export and supply the actual `.riv`; validate every motion value, outfit switch, reduced-motion behavior and cleanup on web and native.

Do not reuse credentials exposed in chat, switch the working preview to an unverified deployment, charge real money, or call the browser/iOS JavaScript export a native pass.
