# Pigeon integration contract

The root integration owner owns `src/domain.ts`, `src/client/**`, `app/_layout.tsx`, package/config files, generated Convex APIs, documentation, and all git operations. Shared-machine specialists must not commit or change other owners' files.

## Backend ownership and APIs

Flight/social owner owns `convex/**` except `_generated/**`, `commerce*.ts`, `whop*.ts`, and `http.ts`. Own `convex/schema.ts`, spreading `commerceTables` from `./commerceSchema`; the commerce specialist supplies that export. Root wires `convex/http.ts` for auth and commerce. Use Convex Auth Password (`@convex-dev/auth`) and authTables. `profiles` table has `userId` (auth users ID), unique handle, cityId, equipped ('classic'|'aviator'), demo:boolean. Export `requireProfile(ctx)` and `optionalProfile(ctx)` from `convex/model.ts` for commerce; both return profile docs (including `_id` and `userId`), requireProfile throws on unauthenticated/unregistered. Commerce equip patches `profiles.equipped`; public projections fetch sender's current equipped value.

Domain DTOs are in `src/domain.ts`. Use IDs as strings in returned DTOs; validators may use `v.id`. Server-authoritative state, separate private messages, no body or recipient identity in public data. Normalize outputs to these DTOs instead of returning DB documents.

Required functions:
- `profiles.me` query -> Profile|null; `profiles.save` mutation `{handle,cityId}` -> Profile. Auth signup uses password then profile save. `profiles.setCity` `{cityId}` -> null.
- `flights.list` query `{scope:'mine'|'world',demo:boolean}` -> `{flights:FlightSummary[],total:number,serverTime:number}`. World anonymous, mine authenticated. Derived due state in query plus scheduled settlement / mutation settlement ensure authoritative arrival; Convex queries cannot write.
- `flights.detail` query `{id:string}` -> `{flight:FlightDetail|null,serverTime:number}`. An id may be a public shareToken or a flight ID. Must return null to unauthorized private viewers. Public details never identify participants.
- `flights.launch` mutation `LaunchInput` -> `{id:string}`.
- `flights.settleMine` mutation `{}` -> null (reconnection/poll settlement if useful).
- `flights.reserve` mutation `{flightId:string}` -> Attempt.
- `flights.resolve` mutation `{attemptId:string,taps:(number|null)[]}` -> AttemptResult. Taps are elapsed milliseconds since attempt `startedAt`, one per 2000ms round. Validate server clock >=6000ms, before lease expires, and round windows; score local elapsed (`tap - round*2000`) with that round's phase. No arbitrary client win boolean.
- `social.list` query `{}` -> Connection[] (accepted and incoming/outgoing requests).
- `social.request` mutation `{flightId:string}` -> `{id:string}` fixed catch request only.
- `social.respond` mutation `{connectionId:string,response:'accept'|'decline'|'block'}` -> null.
- `social.block` mutation `{profileId:string}` -> null; `social.report` `{profileId?:string,flightId?:string,reason:string}` -> null.
- `social.createInvite` mutation `{}` -> `{token:string}`; `social.acceptInvite` mutation `{token:string}` -> null. Invite grants only mutual connection with explicit acceptance, not inbox access.
- `demo.reset` mutation `{}` -> null; `demo.seed` mutation `{}` -> null. Restricted to authenticated isolated demo members, never delete normal data. Explain secure provision/fixtures path in handoff. Never unauthenticated identity switches.

## Commerce ownership and APIs

Own `convex/commerce.ts`, `commerceData.ts`, `commerceSchema.ts`, `whop*.ts`, `tests/commerce*.test.ts`. Read official current docs, use sandbox only. Do not modify schema/root HTTP/generated files; export `commerceTables` and a `whopWebhook` HTTP action for root registration.
- `commerce.catalog` query `{}` -> `{configured:boolean,priceLabel:string,testMode:true}`.
- `commerce.ownership` query `{}` -> `{owned:Outfit[],equipped:Outfit,orders:Order[]}` authenticated.
- `commerce.checkout` action `{sku:'aviator',requestKey:string}` -> Order, authenticated server-bound.
- `commerce.order` query `{id:string}` -> Order|null authenticated own orders.
- `commerce.equip` mutation `{outfit:Outfit}` -> null, requires owned entitlement for aviator.
- Root mounts HTTP action POST `/webhooks/whop`. Signature raw-body verified, events and fulfillment atomic/idempotent; no return URL fulfillment. Environment failures explicit.

## UI ownership and facade

UI owner owns `app/**` except `_layout.tsx`, `src/ui/**`, `assets/pigeon/**`. Expo Router routes: `(tabs)/index.tsx`, inbox/nest/shop, compose, flight/[id], catch/[id], request/[id], sign-in, sky (anonymous read-only), f/[token] (public-safe), invite/[token], checkout-return. Use shared React Native primitives/SVG web export. Root provides `PigeonProvider` and these hooks from `src/client/PigeonProvider.tsx`.

`usePigeon()` returns:
- `configured:boolean`, `authenticated:boolean`, `loading:boolean`, `connected:boolean`, `profile:Profile|null`, `demo:boolean`, `setDemo(boolean)`, `serverNow:number` (aligned monotonic clock), `myFlights:FlightSummary[]`, `worldFlights:FlightSummary[]`, `worldTotal:number`, `connections:Connection[]`, `owned:Outfit[]`, `orders:Order[]`, `catalog:{configured:boolean,priceLabel:string,testMode:true}`, `error:string|null`.
- `signIn({email,password,signUp?,handle?,cityId?}):Promise<void>`, `signOut():Promise<void>`, `saveProfile({handle,cityId}):Promise<void>`, `setCity(cityId):Promise<void>`, `launch(LaunchInput):Promise<{id:string}>`, `reserve(flightId):Promise<Attempt>`, `resolve(attemptId,taps):Promise<AttemptResult>`, `requestConnection(flightId):Promise<{id:string}>`, `respond(connectionId,response):Promise<void>`, `block(profileId):Promise<void>`, `report({profileId?,flightId?,reason}):Promise<void>`, `createInvite():Promise<{token:string}>`, `acceptInvite(token):Promise<void>`, `checkout(requestKey):Promise<Order>`, `equip(outfit):Promise<void>`, `resetDemo():Promise<void>`, `seedDemo():Promise<void>`.
- `useFlight(id:string|undefined)` -> `{flight:FlightDetail|null,loading:boolean,serverNow:number}`.
- `useOrder(id:string|undefined)` -> `{order:Order|null,loading:boolean}`.
- `shareUrl(path:string):string` returns configured HTTPS public origin + path; native deep links use pigeon:// where appropriate.

Root will implement facade backed by real Convex subscriptions, no hidden mock fallback. Unconfigured public UI may show explicit illustrative ambient birds, clearly labeled “Illustration · not live traffic”; do not fabricate active totals, messages, authenticated accounts, payments or success actions. Network actions disabled when not connected; form drafts persist. Keep all requested flows functional when configured.

Common dependencies root installs: Expo Router, react-native-svg, react-native-safe-area-context, react-native-screens, expo-linking, expo-constants, expo-secure-store, expo-crypto, @react-native-async-storage/async-storage, @expo/vector-icons, react-dom, react-native-web, @convex-dev/auth, @auth/core, vitest, convex-test. Request other dependencies by message rather than editing package files.
