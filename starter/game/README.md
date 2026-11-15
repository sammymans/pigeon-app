# Paper slingshot V1 integration

Source: [Paper full-screen slingshot](https://app.paper.design/file/01M7GFFP9QE40C6END0X03AYCB/p-6-0), file `01M7GFFP9QE40C6END0X03AYCB`, page `p-6-0`. All seven game artboards and the three interaction/difficulty/economy boards were read. This **replaces the old six-second net game**; do not use `flights.reserve/resolve` for new V1 room encounters. The previous implementation is preserved in commit `8ce07ba`, not exposed by this module.

## Mounting

`CatchGame` is an Expo Go SDK 58 React Native component, without native-only packages. Mount under the existing authenticated Convex and SafeArea providers. `useCatchTransport()` supplies the new versioned backend adapter. The caller owns the World list, authenticated detail subscription, identity lifecycle, and navigation.

```tsx
const detail = useQuery(api.flights.detail, { id: selectedFlightId });
const connection = useConvexConnectionState();
const transport = useCatchTransport();

return <CatchGame
  flightId={selectedFlightId}
  flight={detail?.flight}
  connected={connection.isWebSocketConnected}
  transport={transport}
  onExit={({ flightId, outcome }) => closeEncounter()}
  onOpenLetter={({ flightId }) => openAuthorizedLetter(flightId)}
/>;
```

Use a canonical ID from authenticated `flights.list({scope:'world',demo:true})`, not a share token or invented bird. Unmount on identity change. `onOpenLetter` runs only for a server-confirmed catch; it does not carry a body. Read the letter through the existing authenticated `flights.detail` projection, preserving sender/catcher access and recipient-only Intercepted status. The advanced 30-minute reply/custody screen belongs to the return module; this core handoff does not invent a return countdown.

`PracticeGame({onExit})` is also exported. It has the same trajectory/collision rules, but no transport, flight identity, server debit, real catch, or letter callback. Empty-pouch UI offers free practice first; Get stones explains free sources and explicitly says paid packs are unavailable.

## Versioned protocol

`CatchTransport` and `GameData` are exported from `contract.ts`, derived from the generated backend return type. Every mutation returns `{encounter, pouch, serverTime}`. Pouch is `{count,capacity:12,nextRefillAt:number|null}`. An encounter has version `slingshot-v1`, ID, flight ID, seed, `preparedAt`, `readyUntil`, `armedAt`, `fireUntil`, `finishBy`, shot limit, accepted shots, terminal state and `endedAt`. States: ready, active, projectile, caught, escaped, expired, delivered, abandoned.

| Endpoint | Arguments | Purpose |
| --- | --- | --- |
| `slingshot.sync` | `{flightId}` | Refresh clock, pouch and settled outcome without starting another attempt |
| `slingshot.prepare` | `{flightId}` | Reserve one encounter idempotently; zero stones returns no encounter |
| `slingshot.arm` | `{encounterId,armedElapsedMs}` | Start the clock on the first armed pull; no debit |
| `slingshot.fire` | `{encounterId,shotKey,releaseElapsedMs,direction:{x,y}}` | Atomically accept one normalized-direction shot and debit one stone |
| `slingshot.end` | `{encounterId}` | End without charging any unfired stones |
| `slingshot.state` | `{flightId}` | Reactive authorized state; its serverTime is the last stored event epoch, not a clock sample |
| `stones.sync/status` | `{}` | Current authenticated shared pouch |

Both elapsed values are milliseconds since the encounter's `preparedAt`, using one monotonic client anchor. Only mutation responses are used for clock alignment. Shots have a stable key; retrying the same accepted release returns its state without another debit. Changed payloads with the same key are rejected. No hit/win flag is accepted from the client. One projectile may be in flight, at most two shots per encounter, and one starting stone limits that encounter to one shot. Buying/refilling cannot add a third shot or reopen an encounter.

Preparation locks the flight for at most 30 seconds and consumes the one attempt for that catcher/flight without charging a stone. The first drag of at least 32 logical points arms; returning within 24 points before release cancels for free but does not restart the clock. Fixed strength, opposite pull direction, short arc preview, 88-point grab circle, 58-point target, and 16-point stone share the same logical scene on narrow/large screens.

Target motion is a seeded smooth horizontal sine with peak speed 90 points/sec at the 390-point reference. The fixed projectile speed is 680 points/sec, gravity 420 points/sec². The server and client share `trajectory.ts`; swept circle tests at 4ms segments prevent tunneling. No random dodge, aim snap, luck roll, or client-claimed collision exists. Projectile duration is bounded by 1600ms, the encounter finish deadline, and actual flight arrival. No new release is accepted at/after the server fire deadline. Timestamps can be at most 350ms old or 100ms ahead to accommodate transport/clock estimation; excessive latency rejects without charging. Arrival wins at the exact boundary.

The old 15-second exclusion, 30-second cooldown and two-attempts-per-flight cap are retained for legacy net attempts only. New V1 uses one encounter per catcher/flight, bounded ready/fire deadlines and shot limits. Sender, recipient, namespace, Sealed and blocked-user exclusions remain. The two engines share a lock exclusion, and the legacy net endpoint rejects new room flights so it cannot bypass the stone pouch.

Exit/background/connection interruption ends the client attempt and submits `end`. On a lost reply, retry retrieves the immutable server outcome. An already committed catch cannot be revoked by a later disconnect; while the server is unreachable, its deadlines remain authoritative and the UI says confirmation is pending. No unfired stone is charged. Reduced motion suppresses decorative effects, not collision motion. No physical-device proof is implied by a web render/export.

## Three-person rooms

Create/join require an **already authenticated fresh Anonymous session** and create only its app profile. They never authenticate, sign out, migrate a pair, or repurpose an existing profile. The welcome UI must make entering a fresh room identity explicit.

| Endpoint | Arguments | Result |
| --- | --- | --- |
| `starterRooms.create` | `{handle,cityId,openAcknowledged:true}` | `null` |
| `starterRooms.join` | `{token,handle,cityId,openAcknowledged:true}` | `null` |
| `starterRooms.status` | `{}` | `null` or `{roomId,isOwner,inviteToken,expiresAt,capacity:3,members:Profile[]}` |
| `starterRooms.launch` | `{recipientId,body,defense,requestKey,openAcknowledged:true}` | `{id}` |

Joining explicitly consents to public interception and connections with other room members. Status contains safe Profile DTOs only. Only the owner receives the token while space/invitation remain; invites expire after 30 minutes, with exact mutation deadline enforcement and scheduled status cleanup. Hide expired tokens with the existing server clock as well. Never log tokens. Concurrent joins cap at three and retries do not duplicate membership/connections.

Every new room letter requires a per-letter risk acknowledgment and is forced Open Skies/demo speed. Reuse `OPEN_SKIES_DISCLOSURE` and an unchecked acknowledgment. The wrapper delegates to existing `launchFor`, preserving sender limits, timing, blocks, 280-character validation and request-key immutability. Old paired identities and historical Sealed letters are untouched. A creates, B and C join, A sends to B, C selects and plays: no fictional birds are needed.

## Integration and verification

The handoff separates isolated modules from shared schema/generated API/legacy-lock changes. YCCM-10 applies the integration patch, regenerates API types, wires the main UI and deploys. There are no dependency, app-shell or map edits here.

```sh
npm test
npx vitest run --config starter/vitest.config.ts
npm run lint
(cd starter && npm run typecheck && npx expo install --check)
```

Backend tests cover actual three-identity room handlers, privacy, atomic lock/debit/idempotency, invalid releases, one/two-shot limits, grace, exact arrival, block recheck and refill. Browser proof uses this exact component against real handlers in an isolated `convex-test` engine, with DOM-observed pointer drags and explicit test identities. It is not a live deployment/authentication/physical-phone claim. Test wrappers and fault injection are outside the repository and never ship with the app.
