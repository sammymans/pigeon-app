# Pigeon first letters

The app currently opens a temporary click-through onboarding preview: enter any phone number and verification code, choose a username, and continue through the flock welcome to the sample app. Phone and code fields can be left blank; usernames require 3–24 ASCII letters, numbers, dots, or underscores and cannot start with a dot. Usernames are trimmed and lowercased, with an optional leading `@` removed. Availability is only checked in connected sign-in. No SMS, account, or real letter is created; everything resets on reload. Use **Restart onboarding** in the map menu to try it again.

Set `EXPO_PUBLIC_ONBOARDING_PREVIEW=false` to restore connected phone sign-in and real flock/flight data. See [phone authentication setup](docs/phone-auth.md): live SMS still requires server configuration and approved legal URLs. First real send includes an explicit home-city choice and private friend invitations.

The local map design preview is preserved. Run `EXPO_PUBLIC_DESIGN_PREVIEW=true npm --prefix starter start` to explore sample birds and flights without an account. Sample sends stay local and reset on reload. See [the preview workflow](starter/README.md#current-local-design-preview).

The **Coop shop** now includes accessory previews and transfers, point purchases, treats, flock protection, and stone refills. The signed-in implementation stores inventory in Convex; the preview uses local sample points. Cash top-ups and additional-pigeon checkout remain unavailable. See [shop behavior and setup](starter/README.md#coop-shop).

An Expo Go-compatible, two-person sealed-letter demo: pair two real anonymous sessions, compose, wait for server-confirmed delivery, read, and send a new timed reply. Demo travel is explicitly labeled 30–90 seconds alongside the normal distance estimate. The public counter remains available through **Connection diagnostic**.

This is the first-letter slice, not the full Paper v1 design or the archived product. No new catching, Rive, payments, discovery, or notification UI is included. The complete old backend is retained to preserve existing cloud functions/data; see [backend retention](docs/backend-retention.md). Never deploy the reduced schema from the earlier counter-only foundation over the shared backend.

## Install and check

Use Node 22 or newer:

```sh
npm ci
npm --prefix starter ci
npm run check
cd starter
npx expo install --check
```

These tests run in memory and do not deploy or mutate cloud data. Root dependencies support the retained backend and regression tests; the isolated starter's lockfile keeps Rive and commerce SDKs out of its Metro graph.

## Run in the cloud

From `starter/`, set the approved public endpoint explicitly and start a separate Metro service behind its HTTPS proxy:

```sh
EXPO_PUBLIC_ONBOARDING_PREVIEW=false \
EXPO_PUBLIC_CONVEX_URL=https://helpful-kudu-864.convex.cloud \
EXPO_PACKAGER_PROXY_URL=https://YOUR-METRO-HOST \
npx expo start --go --host lan --port 8082
```

Supply `EXPO_TOKEN` securely for the same human `sammymans` account used by Expo Go, verify `npx expo whoami`, and use a compatible SDK58 client. The manifest and iOS launch asset must both use public HTTPS. Scan the host's `exps://` QR. Keep Metro running, and do not replace the separately hosted counter preview or its QR.

For pairing and persistence limits, read [starter/README.md](starter/README.md). A creates a pair and privately shares the one-use invitation; B joins from a separate device/browser profile. Send, wait for server delivery, read, then reply. Do not include invitation values in screenshots or logs. Anonymous sign-out loses access to that identity; it is not an A/B switch.

## Evidence and native testing

The deployed source (`949016f`) passed 100 original repository/frontend tests and a real two-browser cloud roundtrip: independent authentication, pairing, recipient-body denial before delivery, outsider denial, scheduled delivery/read, and a separate reply delivered back. This clean projection retains all backend/domain and new starter tests; old product-UI-only files remain in the source archive rather than this PR. Runtime backend, domain, and starter files match the deployed source.

The public iOS manifest and Hermes launch bundle were verified. That is not physical-phone feature proof or a Revyl native build. The first Revyl build after approval targets the original minimal counter, not this larger slice; [docs/revyl.md](docs/revyl.md) keeps those scopes and the automation status explicit.
