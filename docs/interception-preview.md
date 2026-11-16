# Pigeon interception preview

The current click-through app and `EXPO_PUBLIC_DESIGN_PREVIEW=true` entry both use the playable interception flow in `starter/page03/PreviewApp.tsx`.

## Try it

1. The opening map shows **Scout, Fern, and Sunny** passing through a **5 km** area on three unevenly spaced routes. Departure and destination points slide along the original bearings to reach land, shortening routes where a coast is close. A bundled coastline check keeps endpoints inland and preserves the pigeons' nearby positions and interception time. At offshore locations, routes may extend farther; a route with no land endpoint in either search direction is omitted. The map uses the device location, with New York as its fallback. No unrelated worldwide flights or mailbox history are preloaded; the five welcome pigeons are ready to send.
2. Tap a pigeon, then **Intercept**.
3. Drag the blue stone down and sideways. Pulling left sends it right; pulling farther down adds power. The dotted arc previews the trajectory. Release to fire, aiming ahead of the moving pigeon.
4. You get two shots at each pigeon while time remains. One hit wins; two misses end the attempt and leave your other pouch stones untouched. A shot costs one stone from the same pouch used by the coop shop; tapping, cancelling a drag, and entering or leaving the game cost nothing.
5. A catch opens the “Letter intercepted” result and unlocks **Open letter**. It saves the letter under its sender in the mailbox and offers **Reply** directly, with a 30-minute reply window. Replies depart from the device location and return to that sender’s saved coordinates. Escaped letters stay closed. A pigeon cannot be attempted twice during the same preview session.

Use **Refresh nearby pigeons** in the map’s account menu to spawn three fresh practice pigeons and restore at least five practice stones. Resetting nearby pigeons keeps previous caught letters in the postbox. Each bird carries a different letter, saved under **Avery**, **Maya**, or **Jamie**. A full preview reset clears personal flights and mail again.

The pigeon moves roughly 2.6× faster than the previous slingshot, crossing the arena in about 1.25 seconds with the same small hit area; the target uses the same character art as the map with flapping wings. The pigeon leaves after 28 seconds in the ready screen. The first pull starts a 10-second aiming window, capped by that original departure time. The clock continues while backgrounded. A text button below the slingshot offers a keyboard/screen-reader alternative: time a straight shot as the pigeon crosses the center.

## Implementation and scope

- `src/interception.ts`: shared deterministic trajectory, swept collision detection, timing, ammo, and eligibility logic.
- `starter/page03/InterceptionGame.tsx`: the six reference states, touch/mouse controls, accessible fire action, and lifecycle cleanup.
- `starter/page03/PreviewInterception.tsx`: nearby encounters, selection sheet, caught-letter flow, and preview state.
- `starter/page03/nearbyPigeon.ts`: regional routes passing through the local area, geodesic radius, camera bounds, and reset identities.
- `starter/pigeonFlightArtwork.ts`: flight poses derived from the existing pigeon characters, with fitted accessories and mirrored travel direction.
- `starter/page03/previewRouting.ts`: shared departure, reply destination, distance, and arrival estimate.
- `SkyMap.tsx` and `SkyMap.native.tsx`: accessible pigeon markers, with camera framing on first native map load.

This is local preview state. Reloading or resetting the preview restores the sample pigeons. It does not reserve, intercept, or disclose live letters. The retained connected backend's three-round catch protocol is different from this slingshot game and has not been changed by this feature.

Run `npm run check` for repository tests and type checks. The interception tests cover ammo accounting, hit/miss physics, the two-shot limit, a successful final shot, timeouts, background recovery, and eligibility. Preview tests also cover the empty new-user state, nearby relocation, independent catches, sending a first letter, and both nearby and full resets.
