# Slingshot interception

Paper source: https://app.paper.design/file/01M7GFFP9QE40C6END0X03AYCB/p-6-0 (`fileId` 01M7GFFP9QE40C6END0X03AYCB, `pageId` p-6-0). Ready through empty states follow artboards 1IA-0 through 1IG-0; interaction and difficulty follow 1T7-0 and 1T8-0. The blue 58-point circle remains the pigeon placeholder.

## Integration

`LetterApp` mounts `CatchGame` above `Mailbox`, keyed by profile and opaque flight ID. No public flight body is passed into the game. `useCatchTransport` calls the authenticated `slingshot` mutations; `prepare` revalidates public visibility, namespace, sender/recipient exclusions, blocks, arrival and prior/competing attempts. Map callers use `FlightDetail.canSlingshot`; `canCatch` retains the legacy timing-game contract.

An authoritative catch passes the ID through `Mailbox.openFlightId` / `onOpenFlightHandled`. The existing authorized detail query controls body access; the actual Mailbox renders server-returned Open Skies text for its intercepted catcher. Consuming the intent prevents Back from reopening it. Mailbox and its draft controller stay mounted during play, hidden from layout, input and accessibility, so a delayed storage write cannot restore an older draft. Switching accounts discards the entire game navigation boundary.

This version supports **non-trip flights only**. Trip-aware flights (including empty returns) are excluded until the complete custody protocol is available. No 30-minute lease or return reward is advertised or fabricated. No room provisioning, paid packs, courier subsystem, or pigeon/account model is introduced here.

## Rules and authority

- A 390 × 760 logical scene sits between the system-safe areas. Geometry scales uniformly; a 58-point target and 16-point projectile collide on visible overlap, including tangent contact. Swept collision uses 4 ms segments and a bounded 1600 ms projectile life.
- The first 32-point pull starts ten seconds. A return within 24 points cancels free without resetting the clock. Strength is fixed; direction opposes the pull. The grab radius is 44 points. Only the beginning of the trajectory is previewed.
- There are at most two accepted releases, or one if the initial pouch has one stone. One projectile flies at a time. No new release is accepted at or after the deadline; an already accepted projectile may finish. Actual flight arrival takes priority.
- The shared server pouch starts at six, caps at twelve, and regenerates one stone per twenty minutes only below three, up to three. Only an accepted release debits it, atomically with the immutable shot key. Aim, cancel, rejected releases, and practice never debit it. Completed-root-trip +2 rewards remain gated with the separate unfinished custody protocol.
- A local projectile preview responds immediately to release, but it cannot debit a pouch or declare a catch. The server independently computes collision. Unknown outcomes retry the exact key and payload; definitive rejections reconcile before input unlocks.
- Leaving, losing connectivity, or backgrounding ends the attempt without charging an unfired stone. One attempt per person per flight persists across remounts. Free practice has no transport, letter, or reward path.

Reduced motion removes the decorative impact pop while retaining essential target motion. The confirmed impact pauses for 80 ms before the envelope reveal. Miss copy is neutral rather than inventing a directional diagnosis. Keyboard and accessibility actions can arm, adjust the angle, release, and cancel with the same physics and clock.

## Verification

Run `npm run check` for backend, gesture, physics and navigation regressions plus both typechecks. Tests cover timing boundaries, cancellation hysteresis, immutable retries, collision/tangent boundaries, privacy, reservation exclusion, arrival, refill, account changes, and consumed letter navigation.

Browser verification uses the actual Expo components and isolated `convex-test` handlers with separate sender, recipient and catcher identities. It is not a deployed authentication, native-device, or real-network-latency acceptance claim. Temporary verification entrypoints and fixtures do not ship.
