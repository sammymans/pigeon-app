# First-letter backend

## Integration

The slice reuses Convex Auth, `profiles`, `social`, and the existing `launchFor` / `flights` engine. Password accounts retain their normal profiles and normal travel times. Each paired-demo participant signs in independently with the existing Anonymous provider; the invitation never substitutes for authentication. No auth configuration, deployment, credentials, fixture login, or automatic reply was added.

New generated references are `api.starterPair.create`, `join`, and `status`, plus `internal.starterPair.expireInvitation`. Their argument and return shapes match `docs/first-letter-contract.md`.

1. A fresh anonymous user calls `create({handle, cityId})`. This atomically creates one demo profile and an owner-only invitation. No second profile, letter, or connection exists yet.
2. The owner reads `status({})` and privately shares its invitation with another person. It is a random 256-bit capability with a 30-minute server deadline. Do not log, screenshot, or publish its value.
3. A different fresh anonymous user calls `join({token, handle, cityId})`. This atomically creates the second profile, consumes the invitation, and creates one accepted friendship. Concurrent attempts can produce only one second member. The two users remain distinct authenticated identities.
4. Both users see their actual partner through `status` and the accepted connection through `social.list`. Use the partner profile ID for the existing flight APIs.

Handles use the existing global uniqueness and normalization rules: trim whitespace, remove one leading `@`, lowercase, and require 3–24 ASCII letters, digits, or underscores. Invalid/taken handles or invalid cities roll back the mutation without consuming the invitation.

## Membership, expiry, and retries

The additive `starterPairs` table stores an owner, an optional second member, a namespace, and the invitation lifecycle. Each room has its own `demo:pair-…` namespace. It does not enter `demoNamespaces`, so legacy fictional-demo seed/reset controls cannot operate on it. Existing live profiles, other paired rooms, and legacy demos cannot be converted or joined into another room. Existing profile save/city updates never change this namespace or demo mode.

`status` returns `null` to unauthenticated users and nonmembers. A waiting owner receives `{inviteToken, expiresAt, partner:null}`; no other user can inspect that invitation. After joining, both members receive `{inviteToken:null, expiresAt:null, partner:<other profile>}`. After unused-invite expiry, the owner receives `{inviteToken:null, expiresAt:<original deadline>, partner:null}`.

Expiration is enforced in `join` using server time, even if its scheduled state update is delayed. The scheduled mutation closes the token in the reactive status query without reading a wall clock in that query. A delayed scheduler may briefly leave an unusable token in the owner's projection; the original deadline remains authoritative.

An owner retry of `create` is a no-op, including after joining or expiry. A successful member retry of `join` with the same token is also a no-op, including after the deadline. Neither retry changes the original profile, creates another invitation, nor re-accepts a subsequently blocked friendship. A different token or different existing account is not a retry. The agreed API has no invite renewal or room deletion operation; starting a different room requires a fresh anonymous identity, not converting the existing profile.

## Flight behavior

The frontend passes `visibility:'sealed'`, `defense:'cruise'`, `openAcknowledged:false`, and `demo:profile.demo` to the existing `flights.launch`. The server still enforces an accepted, unblocked connection in the same namespace, 1–280 Unicode code points with nonblank text, and the existing three-active-flight cap.

The server snapshots both cities and computes cruise duration as:

- Normal: `max(120, ceil(distanceKm / 60 * 3600))` seconds.
- Demo: `clamp(ceil(distanceKm / 60), 30, 90)` seconds.

No normal duration, existing Open Skies behavior, defense behavior, catch capability, or commerce capability was changed. A demo profile cannot launch with normal-mode flags.

`flights.list` never includes bodies. `flights.detail` gives the sender its own body, but gives the recipient a sealed body only after stored state becomes `delivered`. Foreign and unauthenticated clients cannot read sealed flight detail before or after delivery. Advancing a client clock or running a query never settles a flight. The existing scheduled mutation settles at ETA; `settleMine` recovers overdue flights after reconnect without changing departure/arrival snapshots or duplicating delivery events. A reply is a separately composed launch and must wait for its own server settlement.

New flights persist the additive optional `openAcknowledged` field so every newly launched request payload field is checked on idempotent retry. Changing body, recipient, visibility, defense, acknowledgement, or account mode cannot silently reuse the request key. Exact retries preserve the same flight ID and original snapshots even after city changes or delivery. Existing records without the optional acknowledgement field retain their old retry compatibility; all other payload checks remain enforced.

## Verification

The commands and counts in this section record verification in the original full-source workspace. This clean projection's current commands and retained test scope are in the root README.

`convex/starterPair.test.ts` adds 19 in-memory Convex tests covering identity requirements, private status, room isolation, concurrent membership, retries, exact invite expiry, handle validation/rollback, legacy compatibility, sealed-body projection denial, independent-client access, scheduled settlement, reconnect recovery, timed replies, Unicode limits, immutable payloads, and exact normal/demo durations. Exact route expectations include same-city 120s/30s, San Francisco–Los Angeles 33,548s/30s, San Francisco–New York 247,746s/69s, and New York–London 334,214s/90s (normal/demo).

Passed locally:

```sh
./node_modules/.bin/vitest run
./node_modules/.bin/tsc -p convex --noEmit
./node_modules/.bin/eslint convex --max-warnings 0
```

The full existing suite was preserved: 94 tests in 9 files passed. Tests use Convex Auth-shaped mocked identities via `convex-test`; they are authorization/transaction tests, not proof of deployed Anonymous or Password sign-in. Real authenticated browser sessions, isolated local-runtime scheduling, starter exports, and physical-phone behavior remain integration-owner verification. No live backend or preview was contacted or changed.
