# Pigeon interception preview

The current click-through app and `EXPO_PUBLIC_DESIGN_PREVIEW=true` entry both use the playable interception flow in `starter/page03/PreviewApp.tsx`.

## Try it

1. Open **World** on the map. Pigeon silhouettes mark the flights; the named pigeon chips offer the same selection on small screens.
2. Tap a pigeon, then **Intercept**.
3. Drag the blue stone down and sideways. Pulling left sends it right; pulling farther down adds power. The dotted arc previews the trajectory. Release to fire, aiming ahead of the moving pigeon.
4. You have two shots at each pigeon. One hit wins. A shot costs one stone from the same pouch used by the coop shop; tapping, cancelling a drag, and entering or leaving the game cost nothing.
5. A catch opens the BONK result and unlocks **Open letter**. It also saves a caught letter in the existing postbox with its 30-minute reply window. Escaped letters stay closed. A pigeon cannot be attempted twice during the same preview session.

The pigeon leaves after 28 seconds in the ready screen. The first pull starts a 10-second aiming window, capped by that original departure time. The clock continues while backgrounded. A text button below the slingshot offers a keyboard/screen-reader alternative: time a straight shot as the pigeon crosses the center.

## Implementation and scope

- `src/interception.ts`: shared deterministic trajectory, swept collision detection, timing, ammo, and eligibility logic.
- `starter/page03/InterceptionGame.tsx`: the six reference states, touch/mouse controls, accessible fire action, and lifecycle cleanup.
- `starter/page03/PreviewInterception.tsx`: sample world flights, selection sheet, caught-letter flow, and preview state.
- `SkyMap.tsx` and `SkyMap.native.tsx`: accessible pigeon markers, with camera framing on first native map load.

This is local preview state. Reloading or resetting the preview restores the sample pigeons. It does not reserve, intercept, or disclose live letters. The retained connected backend's three-round catch protocol is different from this two-shot game and has not been changed by this feature.

Run `npm run check` for repository tests and type checks. The interception tests cover ammo accounting, hit/miss physics, two-shot limits, timeouts, background recovery, and eligibility.
