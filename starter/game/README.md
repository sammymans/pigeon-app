# Interception integration

This Expo Go SDK 58 module uses the existing `flights.reserve` / `flights.resolve` engine. The net and center-dot target are deliberately placeholder art, not the final slingshot design. There are no forced outcomes or fabricated public flights.

## Mount from a selected World flight

`CatchGameProps` is exported from `contract.ts`. Supply the canonical flight ID, its authenticated reactive `flights.detail` response, connection state, the transport, and an exit callback. `undefined` means loading; `null` means unavailable. Do not pass a share token or a public list projection as a detail. The caller owns navigation and its existing query-error boundary.

```tsx
import { useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { CatchGame } from './game/CatchGame';
import { useCatchTransport } from './game/useCatchTransport';

function SelectedCatch({ flightId, close }) {
  const detail = useQuery(api.flights.detail, { id: flightId });
  const connection = useConvexConnectionState();
  const transport = useCatchTransport();
  const request = useMutation(api.social.request);
  return <CatchGame
    flightId={flightId}
    flight={detail?.flight}
    connected={connection.isWebSocketConnected}
    transport={transport}
    onExit={close}
    onRequestConnection={async () => { await request({ flightId }); }}
  />;
}
```

Mount only under the existing authenticated Convex provider and `SafeAreaProvider`, and unmount on identity change. `onExit` receives `{ flightId, result }`; `result` is null when leaving without a confirmed result. It does not cancel a server lease. `flightError` and `onRetryFlight` let an adapter with recoverable query errors show a status retry. Keep the detail subscription active after resolution: the immutable result contains no body, and only the authorized detail query may supply the intercepted letter. The component additionally checks flight ID, catcher role, intercepted state, and a confirmed caught result before displaying it.

The optional connection callback must call the existing fixed `social.request`, not send arbitrary text. Three-person room members already have consented connections, so no additional request is offered there.

## Timing and interruption

The existing `src/ui/catchTiming.ts` and `src/domain.ts` remain the sole motion/scoring definitions. All rendering and taps use integer elapsed milliseconds from one `performance.now()` anchor. Each round uses its own server phase and local elapsed time, not accumulated six-second phase time. One timestamp is recorded per round, including exact 2000/4000ms boundaries; 6000ms is closed. The net spans 38–62% of the lane and collisions use the center dot, not the surrounding 32px target.

The existing midpoint clock estimate aligns motion. Submission additionally waits six seconds from receipt minus the server-reported attempt age (plus 50ms), so asymmetric response latency cannot cause an early submission. A recovered reservation with nonzero age is abandoned instead of getting a fresh timer/taps. Disconnect, background, hidden browser tab, or leaving before submission forfeits this client attempt: taps stop, time continues, and it waits beyond the 10-second lease before requesting the expired result. If submission already reached the server before its response was lost, retry retrieves that immutable result; the client cannot revoke an already-confirmed outcome. Retries use the same attempt and exact submitted taps, never reserve another attempt.

Reduced motion removes no scoring motion: the target continues at the real sine position and the UI explains why. There is no decorative motion, Rive dependency, native-only library, or changed collision window.

## Actual three-person room path

The companion `convex/starterRooms.ts` uses the existing anonymous authentication. It **does not authenticate, switch identities, or move an existing profile**. The welcome flow must explicitly obtain a fresh anonymous identity before calling create/join; do not silently sign someone out of an old pair. Both operations require consent to public interception and connecting with the room's other members.

| Endpoint | Arguments | Result |
| --- | --- | --- |
| `starterRooms.create` | `{ handle, cityId, openAcknowledged: true }` | `null` |
| `starterRooms.join` | `{ token, handle, cityId, openAcknowledged: true }` | `null` |
| `starterRooms.status` | `{}` | `null` or `{ roomId, isOwner, inviteToken, expiresAt, capacity: 3, members: Profile[] }` |
| `starterRooms.launch` | `{ recipientId, body, defense, requestKey, openAcknowledged: true }` | `{ id }` |

`cityId`, `defense`, and `Profile` use the existing domain types; `expiresAt` is absolute epoch milliseconds. Status exposes only safe profile DTOs. Only the owner receives an invitation token, while its invite is open and the room has space. The invitation closes after 30 minutes via a scheduled mutation; join checks the exact server deadline transactionally even if scheduling is delayed. The caller should hide an expired invitation using its existing server clock too. Never log tokens or put them in screenshots. Joins and capacity (three) are atomic, and retries do not create extra members or connections. Existing membership retries return idempotently even after the invitation closes.

Every new room launch requires a per-letter risk acknowledgment and is forced to `visibility: 'open', demo: true`. Reuse `OPEN_SKIES_DISCLOSURE` and an unchecked per-letter acknowledgment. The wrapper delegates to `launchFor`, preserving active-flight limits, timestamps, consent/block checks, 280-character limit, and request-key immutability. Existing pairs and historical Sealed records are untouched. The old general API remains backward-compatible; the new V1 composer must use the new room launch path, not relabel a Sealed payload.

For a real catch: A creates the room, B and C explicitly join; A sends a letter to B; C selects it from authenticated `flights.list({scope:'world',demo:true})`, then obtains its authenticated detail and opens this component. Sender and recipient cannot catch; C cannot catch flights from another room. No fictional birds are required. The same `flights.detail/list`, `profiles.me`, and `social.list` subscriptions serve the rest of this flow.

## Shared integration files

The handoff separates game/room implementation from the two shared-file edits owned by YCCM-10:

1. Import and spread `starterRoomTables` from `convex/starterRoomSchema.ts` in the existing schema.
2. Regenerate the Convex API, or apply the provided additive type import/map entry for `starterRooms` in `convex/_generated/api.d.ts`.

No existing table, index, endpoint, pair behavior, shared UI, manifest, dependency lock, or flight engine was changed. The new table is bounded room membership, not a chat system. Deploying and final UI integration belong to YCCM-10; this handoff performs neither.

## Verification commands

After applying both patches to `949016f78d20ec17afd7e02b5727d0638596d509`:

```sh
npm ci
(cd starter && npm ci)
npm test
npx vitest run --config starter/vitest.config.ts
npm run lint
(cd starter && npm run typecheck && npx expo install --check)
```

The root suite covers flight concurrency, immutable outcomes, cooldown/two-attempt limits, arrival priority, blocked/Sealed exclusions, body privacy, and the new three-person room flow. The starter suite covers monotonic timing, phase alignment, tap boundaries, duplicate submissions, latency, lost replies, disconnect, and resumed reservations. Browser evidence uses this exact React Native component with real room/flight handlers in an isolated `convex-test` engine, three explicit test identities, and DOM-observed pointer clicks; it is not a cloud-auth or physical-phone proof. The browser wrapper, transport fault injection, and fixture setup are verification-only and are not included in the app.
