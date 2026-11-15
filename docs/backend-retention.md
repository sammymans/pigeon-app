# Retained backend and source provenance

The foundation PR deliberately included only a counter schema, so it was unsafe to deploy over the existing shared backend. This follow-up restores the complete retained backend and shared `src/domain.ts` from original commit `6f18957645086ba8062f028cbc801ee3fbac21ab`, without importing the old product frontend, assets, Rive runtime, or native product dependencies.

The restored auth, profiles, flight engine, social, demo, catch, commerce, HTTP endpoints, schema and tests preserve what was already deployed to development `helpful-kudu-864`. Catch/commerce code is retained to avoid removing live functions or invalidating existing data; it is not a newly authorized feature and is not exposed by the first-letter frontend. The backend's Whop dependency is for those retained functions, not the Expo bundle.

The first-letter delta adds the `starterPairs` table and four pairing functions, an optional `flights.openAcknowledged` field for complete retry comparison, and shared handle normalization. It does not change normal travel speed, flight limits, privacy mode, auth providers, or commerce behavior. See [first-letter-backend.md](first-letter-backend.md) for the actual additions.

## Safe development deployment

Only the integration owner deploys. Confirm the securely provided deployment key targets exactly `dev:helpful-kudu-864`; never log its value, fall back to another target, or use `--prod`/preview recreation. Reconcile the complete source with any changes made since the last verified deployment. Run tests/typechecks, inspect `npx convex deploy --dry-run --typecheck enable`, and stop if existing tables, functions, or indexes would be removed. Only then use `npx convex deploy --typecheck enable` with the verified development key. Do not change the existing Convex Auth environment variables.

The coordinated first-letter deployment from source `949016f` was dry-run and deployed additively. All 47 prior function/HTTP identifiers remained, four pairing functions were added, and only three new pairing indexes were introduced. Auth discovery and the public counter were rechecked. This PR projects the same runtime files; future drift still requires a fresh comparison, not blind redeployment.

## Retained history

Original history remains unmodified in `captain-fapy/handoffs/YCCM-2-starter.bundle`, also provided as `handoffs/YCCM-7/base.bundle`: `759866c` (empty ancestor) → `31c2097` (foundation) → `06ebf3c` (archived full product) → `6f18957` (counter).

The 26-file first-letter handoff patch was applied to that full history and committed under the verified current author as `949016f78d20ec17afd7e02b5727d0638596d509`, pushed to `capy/first-letters-preview`. That source branch preserves historical authorship and hosts the separate live preview; it is not the intended main-targeting PR. This clean follow-up projects only retained backend/shared domain and the approved first-letter frontend onto the reviewed foundation, with no old full-product UI dump.

No credentials, account caches, pairing invitations, auth keys, databases, or runtime state belong in source or handoffs. The old counter remains independently hosted; do not overwrite its process or QR when handing off the first-letter preview.
