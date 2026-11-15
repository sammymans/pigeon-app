# First letter slice (YCCM-7)

This contract supersedes the wider integration contract only for the new `starter/` frontend. Preserve the old product and all existing backend capabilities. No live deployment, published preview, new credentials, native build, Rive, commerce, catching, or notification work.

## Ownership

- Frontend agent: `starter/**`, except package manifests/lockfiles, app config and tsconfig (parent-owned).
- Backend agent: `convex/**` except `_generated/**`, plus `docs/first-letter-backend.md`.
- Parent: generated API, shared manifests/config, integration checks, screenshots, commits, bundle and handoff. Only parent runs git writes or dependency installation. Both agents share this isolated cloud checkout; no edits outside owned paths.

## Identity and paired demo

Use existing Convex Auth (`@convex-dev/auth`), Anonymous for an isolated demo, Password for an existing regular account. Never impersonate a user via a client ID or fixture identity switch. Auth tokens persist using Expo-compatible secure storage. Each device/browser session has its own identity; there is no switch-to-B shortcut.

Add `starterPair` APIs. `Profile` and `CityId` refer to `src/domain.ts`.

- `starterPair.create` mutation `{handle:string,cityId:CityId}` -> `null`. Requires a fresh anonymous auth user; atomically creates its demo profile and a two-member room with a random, expiring one-use invite capability. Retrying by that owner is harmless. No fictional pen pals, seeded letters, or automatic replies.
- `starterPair.join` mutation `{token:string,handle:string,cityId:CityId}` -> `null`. Requires a fresh anonymous user; atomically joins the room and creates the accepted connection. Second join by the same user is harmless; third users, expired/wrong tokens, ordinary/other-demo accounts reject. Do not convert existing profiles or affect legacy demo namespaces.
- `starterPair.status` query `{}` -> `{inviteToken:string|null,expiresAt:number|null,partner:Profile|null}|null`. Only members see this state. Only the owner sees the unused token. Token is a private invitation, not an auth credential; do not log it or include it in screenshots/artifacts. Joining consents to this demo friendship. Profile identity comes only from Convex Auth.

## Existing APIs are the flight contract

Use generated `api`: `profiles.me`, `profiles.save`, `profiles.clock`, `social.list`, `flights.list({scope:'mine',demo:profile.demo})`, `flights.detail({id})`, `flights.launch(LaunchInput)`, `flights.settleMine`, and `starterDemo.read/increment`. Use only accepted connections for recipient selection. List projections contain no bodies; only detail can return readable text. Frontend displays a recipient body only when the returned state is `delivered` and body exists. Reply opens a new blank compose to `otherProfileId`; it is a new timed launch.

Sealed is the only exposed mode in this slice. Launch fixes visibility=`sealed`, defense=`cruise`, openAcknowledged=`false`, demo=`profile.demo`. Reuse `launchFor`, timing, settlement and body authorization; don't fork the flight engine. Preserve all previous tests. New tests cover auth/membership isolation, pre/post ETA privacy, exact distance duration, idempotency and reply.

## Timing, drafts, and UI

Normal time is max(120, ceil(distanceKm/60*3600)) seconds. Demo time is clamp(ceil(distanceKm/60),30,90). An isolated demo cannot change to live mode; prominently show its normal duration estimate alongside the explicit Demo speed label and accelerated ETA. Existing regular accounts launch normal letters. Endpoints and timestamps are snapped server-side. Use `profiles.clock` for display offset, never local wall clock as permission to read. At countdown zero show awaiting server confirmation until query says delivered; `settleMine` can recover overdue state after reconnection.

Persist drafts per profile in AsyncStorage, including a requestKey created once per immutable launch payload. On network failure retain exact payload/key for retry; do not clear until server acknowledgement. If user explicitly edits after a failed launch, keep the retry ambiguity clear and avoid silently creating a second flight. No fake success or optimistic delivered state.

Phone-sized clean postal template, static placeholder bird/envelope, no custom native dependencies. Accessible labels/roles, >=44-point controls, safe-area/keyboard handling and scrollable content. Keep the original shared-counter diagnostic reachable. Use `EXPO_PUBLIC_CONVEX_URL` explicitly: no hard-coded live target in this branch's frontend. Missing config shows a truthful setup state, not fake accounts.

## Verification and handoff

Run backend tests, root/backend/starter typechecks, Expo Go package compatibility and web/iOS JS exports. Parent will run an isolated local Convex deployment and browser sessions if the local runtime is available, never touch the live counter deployment. Web phone-size evidence is not physical iPhone proof. No preview publication until Captain explicitly hands off after counter confirmation.
