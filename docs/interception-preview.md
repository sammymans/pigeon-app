# Pigeon interception preview

The current click-through app and `EXPO_PUBLIC_DESIGN_PREVIEW=true` entry both use the playable interception flow in `starter/page03/PreviewApp.tsx`.

## Try it

1. The opening map shows **Scout, Fern, and Sunny**, three practice pigeons whose whole routes stay inside a **5 km** circle. All three paths are visible together; the home action is **Send a message**. Tap the location button to move all three near your device; existing location permission is reused automatically. Without permission, the map clearly labels its New York fallback as a preview area. Other sample flights remain in **World**. A new user has no sent or incoming flights and an empty mailbox; the five welcome pigeons are ready with zero deliveries.
2. Tap a pigeon, then **Intercept**.
3. Drag the blue stone down and sideways. Pulling left sends it right; pulling farther down adds power. The dotted arc previews the trajectory. Release to fire, aiming ahead of the moving pigeon.
4. You have two shots at each pigeon. One hit wins. A shot costs one stone from the same pouch used by the coop shop; tapping, cancelling a drag, and entering or leaving the game cost nothing.
5. A catch opens the BONK result and unlocks **Open letter**. It also saves a caught letter in the existing postbox with its 30-minute reply window. Escaped letters stay closed. A pigeon cannot be attempted twice during the same preview session.

Use **Reset nearby pigeons** in the map’s account menu to spawn three fresh practice pigeons and restore at least five practice stones. Resetting nearby pigeons keeps previous caught letters in the postbox. Each bird carries a different letter, saved under **Someone nearby**. A full preview reset clears personal flights and mail again.

The pigeon leaves after 28 seconds in the ready screen. The first pull starts a 10-second aiming window, capped by that original departure time. The clock continues while backgrounded. A text button below the slingshot offers a keyboard/screen-reader alternative: time a straight shot as the pigeon crosses the center.

## Implementation and scope

- `src/interception.ts`: shared deterministic trajectory, swept collision detection, timing, ammo, and eligibility logic.
- `starter/page03/InterceptionGame.tsx`: the six reference states, touch/mouse controls, accessible fire action, and lifecycle cleanup.
- `starter/page03/PreviewInterception.tsx`: sample world flights, selection sheet, caught-letter flow, and preview state.
- `starter/page03/nearbyPigeon.ts`: local practice routes, geodesic radius, camera bounds, and reset identities.
- `SkyMap.tsx` and `SkyMap.native.tsx`: accessible pigeon markers, with camera framing on first native map load.

This is local preview state. Reloading or resetting the preview restores the sample pigeons. It does not reserve, intercept, or disclose live letters. The retained connected backend's three-round catch protocol is different from this two-shot game and has not been changed by this feature.

Run `npm run check` for repository tests and type checks. The interception tests cover ammo accounting, hit/miss physics, two-shot limits, timeouts, background recovery, and eligibility. Preview tests also cover the empty new-user state, nearby relocation, independent catches, sending a first letter, and both nearby and full resets.
