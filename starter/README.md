# First-letter Expo starter

## Current local design preview

The app currently opens `OnboardingPreview.tsx`: a local click-through flow for phone entry, verification, username setup, and the flock welcome. Any phone number and code work, including blank fields. A username is required: use 3–24 ASCII letters, numbers, dots, or underscores, with no leading dot. Surrounding whitespace and an optional leading `@` are removed, and letters are lowercased. Invalid usernames show inline guidance and disable **Meet my pigeons**; availability is only checked in connected sign-in. The flock welcome uses the entered name, falling back to the username when no name is entered. **Explore the map** opens the map with the Mochi, Pip, Button, Noodle, and Puddle flock ready to send a letter when you choose. No sign-in or Convex configuration is needed, and no SMS, accounts, or real messages are created. Sample changes reset on reload; **Restart onboarding** in the map menu also returns to the first step.

Set `EXPO_PUBLIC_DESIGN_PREVIEW=true` to skip onboarding and open the map directly. Set `EXPO_PUBLIC_ONBOARDING_PREVIEW=false` (without design preview) to use the connected letter flow retained in `LetterApp.tsx`.

From the repository root, run `npm --prefix starter start`, then press `i` to open Expo Go in the iOS simulator. The iOS map locates the device on entry and uses Apple Maps through the Expo-compatible `react-native-maps` package; no API key is needed. It initially frames the sample flights. Drag to pan, pinch to zoom, or tap a flight to focus its route. Tap the target button to allow foreground location access and zoom to your current area. This takes a one-time location reading and shows a blue dot; it does not change your home city or send coordinates to the backend. If permission is denied or location is unavailable, the map stays usable. In the iOS Simulator, the result uses the simulator’s configured location. The browser build retains a static vector fallback.

Both preview entry points start as a new user: no sent or incoming flights, no mailbox history, and the five welcome pigeons ready with zero deliveries. **Scout, Fern, and Sunny** pass within 5 km of the map center on separate regional routes. Their departure and destination points extend beyond the nearby area; the three old worldwide flights are removed. See [interception preview](../docs/interception-preview.md).

**Send a pigeon** starts with **Who’s it for?**: choose a friend, someone nearby, or a new person to invite in the local demo. Then write the letter and choose an available pigeon from the shared coop portraits. Review shows flight duration, route distance, assumed speed, and arrival time. Busy or hatching pigeons cannot be selected. An empty coop links directly to the pigeon shop; adding a demo pigeon returns to the same letter and review without payment. A preview send moves that bird to Flying and adds a local flight. The coop shop supports local point purchases, accessory try-ons and transfers, treats, flock guard, and stone refills. Point top-ups remain local and never charge a payment method. Open the shopping-bag icon beside Messages at the top right, or open **My coop** beside **Send a pigeon**, then **Visit the coop shop**. The taller flock panel keeps the shop link fixed above Send, outside the scrolling bird details. The wooden coop shows your flock count. The account menu remains on the wordmark row. The World sky also has a quick stone-shop shortcut.

Sammy’s repeatable demo route is San Francisco → Vancouver, Canada: approximately 1,281 km at an assumed 60 km/h, or 21h 21m (19h 13m with a tailwind treat). The same calculated duration and endpoints drive review, confirmation, and the map flight. Other messages depart from the device location (New York is the fallback if unavailable). Invitations in the local preview collect a name and city but do not contact anyone; connected invitations still use the existing friend-invite flow. Caught letters keep the original sender’s coordinates and offer a direct **Reply** action; replying sends that pigeon from the current device location back to its sender. Review and map arrival times both use distance at 60 km/h, including any queued treat.

The mailbox icon opens an alphabetical grid with unopened counts. Mailboxes appear as you send or catch letters. Tap a person to see their incoming and outgoing envelopes, then open one letter in a reading sheet. Closing it keeps your place in the conversation. New letters use a recipient picker, 500-character sheet, and pigeon review. Caught letters have a 30-minute reply window; nearby recipients and returning couriers are local demonstrations. Connected replies still launch a new flight with one of your own available pigeons, and only accepted friends are selectable. Opened-letter IDs are stored per account and deployment on this device; they do not sync across devices. The backend must be deployed with the matching 500-character validation before longer live letters can be sent.

The sections below describe the retained connected letter flow, not the current local entry point.

A phone-sized, Expo Go-compatible frontend for the first sealed-letter slice. It loads no old product routes, Rive, commerce, catching, or custom native modules. `docs/first-letter-contract.md` defines the original implementation contract; the coordinated cloud deployment/preview is now authorized and verified as described in the root README.

## Configuration and verification

For the connected flow, set `EXPO_PUBLIC_ONBOARDING_PREVIEW=false` and set `EXPO_PUBLIC_CONVEX_URL` explicitly to the approved isolated Convex backend before starting or exporting Expo. There is no default live target. Missing configuration shows a setup screen and performs no account or letter operations. Do not repoint or publish over the existing counter preview.

From the repository root, run `npm --prefix starter run typecheck` and `node_modules/.bin/vitest run --config starter/vitest.config.ts`. Only the integration owner installs dependencies, generates API bindings, runs backend/server commands, or starts previews. The local backend needs the existing Convex Auth setup and the additive `starterPair` APIs.

`EXPO_PUBLIC_CONVEX_URL=<approved-isolated-target> node starter/check-sync.mjs` subscribes as two independent public counter clients and increments once. It refuses to run without an explicit target. This is a write check, not a private-letter or authentication check.

## Two-person flow

1. On one device or browser profile, choose **Create pair**, start the anonymous session, and choose a handle and home city.
2. Reveal the private, expiring invitation only to share it with your partner. Hide it before screenshots or recordings. On a separate device/browser profile, the partner chooses **Join pair** and accepts that invitation. Browser tabs sharing local storage are not independent identities.
3. Choose the accepted friend and write up to 500 Unicode codepoints. Demo accounts always use labeled 30–90-second travel, alongside the normal city-distance travel estimate. Existing Password accounts use normal time and their existing accepted friends.
4. Send. The returned flight subscription supplies the exact route, departure, ETA, and state. Incoming letters never include body text in lists. The detail view shows text only after the server returns `delivered` and a body. Replies start blank and launch a new timed flight.

## Persistence and recovery

Native auth tokens use Expo SecureStore; web uses Convex Auth’s namespaced local storage. Anonymous access belongs to the saved session; signing out does not provide a way to recover it or switch to the other partner.

Drafts are stored locally in AsyncStorage, keyed by deployment and profile. They are not encrypted by AsyncStorage. Before any launch, the exact sealed payload and one request key are saved. An unacknowledged send stays immutable across retries and reloads; it cannot be silently edited into a second flight. The draft is cleared only after acknowledgement. If local cleanup fails after acknowledgement, the session retries cleanup without launching again. An unreadable saved draft is not silently overwritten.

The display clock is anchored to `profiles.clock`, with reconnect/foreground refresh and `settleMine` recovery. Reaching zero means **Awaiting server confirmation**, never optimistic delivery. The public shared-counter diagnostic remains accessible from the footer, including before sign-in.

Web phone-size evidence is not physical iPhone proof. Native execution still needs an approved Expo Go or device test; JavaScript export alone does not prove it.

## Coop shop

`CoopShop.tsx` is shared by the preview and signed-in app. `src/shop.ts` defines prices and inventory rules. The signed-in flow uses atomic Convex `coop.transact` mutations, account-owned pigeon checks, and request receipts to protect against duplicate charging and overspending. Deploy the additive `coopWallets` and `coopReceipts` schema and new functions together before using the connected shop. No cloud deployment is performed by the local implementation.

Each wallet starts with 120 welcome points, five stones, the Sunday cap and Flight goggles, and one Tailwind treat. Sending a new letter earns five points once; retries earn nothing extra. One accessory is worn by one pigeon at a time, and a pigeon wears one accessory. An owned item can be moved or removed without paying again. A queued treat reduces its selected bird’s next flight duration by 10%; it is consumed once on launch. Flock guard costs 40 points and makes attempts started during the next hour require all three hits, including for already-flying birds. Stones cost 50 points for five; the backend uses one stone for each new catch reservation and refills one per 15 minutes up to five. The separate local slingshot preview spends one per shot.

The connected shop uses Whop hosted checkout for point packs and configured permanent-pigeon purchases. Signed webhooks plus a fresh payment lookup deliver inventory once; returns only show server status. Missing configuration disables checkout per product. The legacy Aviator SKU remains supported separately. See [Whop setup](../docs/whop-store.md) for credentials, product settings, webhook URLs, refunds, and the sandbox test. Preview point top-ups remain local and never contact Whop. Preview inventory resets on reload; connected inventory is stored per profile.
