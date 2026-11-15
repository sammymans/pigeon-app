# First letter preview handoff

This is the next narrow checkpoint after the shared-counter starter, not a restart of the older full product. It has not been deployed to the shared cloud Convex deployment and has no published preview. The counter preview remains owned by YCCM-2. Obtain Captain's explicit handoff before these deployment steps.

Captain subsequently supplied Paper roughv1 to YCCM-11 for a separate read-only design analysis. Its possible changes to interception, flock capacity, 80 km/h, 500 characters, nearby/SMS invites and same-courier replies are not approved behavior changes. This handoff deliberately retains Sealed default, 280 codepoints, the existing 60 km/h normal formula and a new timed flight per reply. Resolve the design delta with Captain before changing that contract; no Paper assets or new gameplay were implemented here.

## Review and restore

The delivery is `captain-fapy/handoffs/YCCM-7/base.bundle` (the preserved starter history at `6f18957`) plus `first-letter.patch` (the reviewed new source). Sammy's account-ownership direction holds new commits and pushes until the active Capy owner/GitHub actor is verified; the patch is intentionally uncommitted. Inspect current remote/local branches first and preserve any newer work. Restore into a new cloud checkout; do not overwrite YCCM-2's running worktree, environment files, process, or preview URL. Only the integration owner should merge newer source if it has changed.

For a fresh offline review checkout: `git clone -b capy/convex-starter <handoff>/base.bundle <new-folder>`, then `cd <new-folder> && git switch -c capy/first-letter && git apply --check <handoff>/first-letter.patch && git apply <handoff>/first-letter.patch`. This creates no authored commit. Before any commit or publication, freshly verify the active crew owner and GitHub identity/write permissions after the ownership transfer; never override git author fields or switch accounts implicitly.

Review the delta from `6f18957`, not the whole inherited app. `docs/first-letter-contract.md` explains interfaces and ownership; `docs/first-letter-backend.md` describes additive schema/auth changes. The old product remains present but is not imported into the starter UI. No native build is needed.

## Coordinated cloud deployment (not executed by YCCM-7)

1. On the approved cloud machine, install root dependencies with `npm ci` and frontend dependencies with `npm --prefix starter ci`. Use existing securely configured credentials only. Do not copy `.env.local`, `.convex`, auth keys, tokens or databases from the integration machine or bundle.
2. Run `npm test`, `npx vitest run --config starter/vitest.config.ts`, `npm run typecheck`, `npm --prefix starter run typecheck`, and `(cd starter && npx expo install --check)`.
3. The infrastructure owner must verify the existing securely configured deployment key targets exactly `dev:helpful-kudu-864`, preserve its existing Convex Auth environment, and apply the complete repository's backend additively with `npx convex deploy --typecheck enable`, using the verified development-key workflow from the counter starter. Never run this with a missing/unverified key, `--prod`, a default guessed target, a reduced schema, or a new provider. The new table is `starterPairs`; the only changed existing table field is optional `flights.openAcknowledged`. No data migration/deletion is required.
4. Smoke-check the deployed `starterPair` API and existing auth discovery before publishing the frontend. No new auth credentials should be needed: the existing Convex Auth Anonymous and Password providers remain unchanged.
5. Start a separate cloud Metro process from `starter/` on an available port. Set `EXPO_PUBLIC_CONVEX_URL=https://helpful-kudu-864.convex.cloud` and `EXPO_PACKAGER_PROXY_URL` to the new preview origin, use the existing securely configured human Expo identity `sammymans`, and run `CI=1 npx expo start --go --host lan --port <port>`. Publish a new titled preview, not a replacement for the counter. Verify its iOS manifest and public HTTPS launch bundle before handing out the new QR. SDK 58 and the same Expo account are required; Sammy has confirmed only the previous counter QR on his phone.

## Phone acceptance checkpoint

Use two devices or genuinely separate browser profiles. Do not create two tabs on the same origin and assume they are independent identities.

1. A chooses **Create pair**, enters a unique handle/home city, and privately sends the one-use invitation to B. The invitation expires after 30 minutes. Do not record it in screenshots, issue comments, or handoff files.
2. B chooses **Join pair**, enters another handle/city, and accepts the invitation. Both now see the other as an existing friend; no fictional recipient or automatic reply exists.
3. A selects B and writes up to 280 Unicode codepoints. Sealed is the only mode exposed. Confirm the normal distance estimate and explicit **Demo speed** label before launching. Same-city demo takes 30 seconds; normal same-city estimate is two minutes. Long demo routes take 90 seconds; normal distance duration is never silently shortened.
4. A sees the server route, departure, ETA and status. B sees pending metadata with no body. Reload/reopen without signing out; the server trip must continue. A failed/ambiguous send retains the exact draft/request key for a duplicate-safe retry.
5. After server-confirmed delivery, B can read and reply. The reply must be a new in-flight letter; A cannot read it early. Countdown zero alone must never reveal text.
6. Open **Connection diagnostic** to confirm the shared counter remains understandable. This diagnostic is public; letters are private.

Anonymous identity persists on its device but is not recoverable after explicit sign-out or storage clearing. Signing out is not an A/B switch. Existing regular Password accounts can sign in and send normal-speed letters to their accepted friends; this slice does not add account recovery or friend discovery.

## Evidence boundaries

The integration owner's report records actual isolated local Convex Auth, API, scheduled delivery and browser tests plus SDK compatibility/JS export checks. Those prove code behavior without modifying the shared deployment. Web phone-size screenshots and an iOS JavaScript bundle are not proof that this feature slice ran in Expo Go on a physical iPhone; that remains the coordinated checkpoint above.
