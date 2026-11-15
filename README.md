# Pigeon Paper map and Open Skies

> Rejected visual reference: Sammy did not accept this approximation of Paper page 03. Preserve it for comparison only; corrected source-compared screens are required before design readiness or a new phone-approval ask. Functional tests do not establish visual fidelity.

An Expo Go-compatible map-first letter demo with the supplied Paper Pip vector, My flights/World views, recipient picker, postal composer, delivery/read and timed reply. Pair two real anonymous sessions and send an explicitly acknowledged Open Skies letter. Demo travel is labeled 30–90 seconds alongside the normal distance estimate. The public counter remains available through **Connection diagnostic**.

This is the verified map/send checkpoint, not completed gameplay. The new slingshot, three-person rooms and return custody are separate integration work; interception is visibly unavailable when its handler is absent. No old timing game is relabeled as the new design. There is no Rive, payment, discovery or notification feature in this frontend. The complete old backend is retained to preserve existing cloud functions/data; see [backend retention](docs/backend-retention.md).

New letters are Open Skies only, but risk acknowledgment is never automatic. Editing body/recipient resets consent. An unsent legacy sealed draft needs explicit conversion and fresh consent; an uncertain historical sealed send retains its exact payload/key. Existing sealed letters never become public. World summaries contain city routes, not GPS or letter bodies.

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
EXPO_PUBLIC_CONVEX_URL=https://helpful-kudu-864.convex.cloud \
EXPO_PACKAGER_PROXY_URL=https://YOUR-METRO-HOST \
npx expo start --go --host lan --port 8083
```

Supply `EXPO_TOKEN` securely for the same human `sammymans` account used by Expo Go, verify `npx expo whoami`, and use a compatible SDK58 client. The manifest and iOS launch asset must both use public HTTPS. Scan the host's `exps://` QR. Keep Metro running, and do not replace the separately hosted counter preview or its QR.

For pairing and persistence limits, read [starter/README.md](starter/README.md). A creates a pair and privately shares the one-use invitation; B joins from a separate device/browser profile. Choose **Send a pigeon**, select B, write, acknowledge the Open Skies disclosure, and choose **Let it fly**. Wait for server delivery, read, then acknowledge a new reply. Do not include invitation values in screenshots or logs. Anonymous sign-out loses access to that identity; it is not an A/B switch.

## Evidence and native testing

The frozen Paper preview source (`4337d07`) passed real two-browser cloud acceptance for pairing, map/World, consent reset, actual Open Skies payload, pending-body privacy, scheduled read and a separately acknowledged reply delivered back. Its SDK58 iOS manifest and 4,948,490-byte public HTTPS bundle passed. This PR has the same runtime and additionally retains the preceding PR's rejection-recovery regression. No mock browser success is claimed as live proof.

Physical-phone confirmation remains separate. The original counter has native Revyl build/install/tap/sync proof; a new build of this exact Paper UI has been requested but is not yet claimed successful. [docs/revyl.md](docs/revyl.md) keeps those scopes and the automation status explicit.
