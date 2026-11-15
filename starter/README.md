# First-letter Expo starter

A phone-sized, Expo Go-compatible Paper map/letter frontend. It loads no old product routes, Rive or commerce. The only added rendering dependency is Expo-compatible `react-native-svg`; Pip uses the actual supplied Paper vector. `docs/first-letter-contract.md` is historical; the current Open Skies/legacy consent contract and verified preview are described in the root README.

## Configuration and verification

Set `EXPO_PUBLIC_CONVEX_URL` explicitly to the approved isolated Convex backend before starting or exporting Expo. There is no default live target. Missing configuration shows a setup screen and performs no account or letter operations. Do not repoint or publish over the existing counter preview.

From the repository root, run `npm --prefix starter run typecheck` and `node_modules/.bin/vitest run --config starter/vitest.config.ts`. Only the integration owner installs dependencies, generates API bindings, runs backend/server commands, or starts previews. The local backend needs the existing Convex Auth setup and the additive `starterPair` APIs.

`EXPO_PUBLIC_CONVEX_URL=<approved-isolated-target> node starter/check-sync.mjs` subscribes as two independent public counter clients and increments once. It refuses to run without an explicit target. This is a write check, not a private-letter or authentication check.

## Two-person flow

1. On one device or browser profile, choose **Create pair**, start the anonymous session, and choose a handle and home city.
2. Reveal the private, expiring invitation only to share it with your partner. Hide it before screenshots or recordings. On a separate device/browser profile, the partner chooses **Join pair** and accepts that invitation. Browser tabs sharing local storage are not independent identities.
3. Choose the accepted friend and write up to 280 Unicode codepoints. New letters use Open Skies and need explicit acknowledgment that an eligible catcher can read them and prevent delivery. Body/recipient edits reset that acknowledgment. Demo accounts always use labeled 30–90-second travel, alongside the normal city-distance travel estimate. Existing Password accounts use normal time and their existing accepted friends.
4. Send. The returned flight subscription supplies the exact route, departure, ETA, and state. Incoming letters never include body text in lists. The detail view shows text only after the server returns `delivered` and a body. Replies start blank and launch a new timed flight.

## Persistence and recovery

Native auth tokens use Expo SecureStore; web uses Convex Auth’s namespaced local storage. Anonymous access belongs to the saved session; signing out does not provide a way to recover it or switch to the other partner.

Drafts are stored locally in AsyncStorage, keyed by deployment and profile. They are not encrypted by AsyncStorage. Before launch, the exact payload and one request key are saved. Ambiguous/reloaded pending sends stay immutable across retries; old sealed payloads are never converted. Only a fresh launch definitively rejected by the server becomes editable again, retaining its text and requiring new Open Skies consent. Unsent old sealed drafts need explicit conversion. A server-accepted draft is cleared only after acknowledgment; failed cleanup retries without another launch. Unreadable storage is not silently overwritten.

The display clock is anchored to `profiles.clock`, with reconnect/foreground refresh and `settleMine` recovery. Reaching zero means **Awaiting server confirmation**, never optimistic delivery. The public shared-counter diagnostic remains accessible from the footer, including before sign-in.

Web phone-size evidence is not physical iPhone proof. Native execution still needs an approved Expo Go or device test; JavaScript export alone does not prove it.
