# Counter frontend

This is an isolated Expo SDK 58 app. It calls only `starterDemo:read` and `starterDemo:increment` at `https://helpful-kudu-864.convex.cloud`. That endpoint is public development configuration, not a secret. The counter contains no account or private app data.

## Cloud Metro and a physical iPhone

From this folder, install with `npm ci` and check with `npm run typecheck`.

1. Supply `EXPO_TOKEN` securely for the same human Expo account used by Expo Go on the phone. Verify `npx expo whoami`; the expected account for the existing preview is `sammymans`. Never commit tokens or copy another thread's credentials.
2. Start Metro on a cloud host, with its HTTPS reverse proxy's public origin:

   ```sh
   EXPO_PACKAGER_PROXY_URL=https://YOUR-METRO-HOST npx expo start --go --host lan --port 8081
   ```

3. Check that the public iOS manifest and its launch asset both return successfully and use that HTTPS host, not localhost. Use the host's `exps://YOUR-METRO-HOST` QR in a compatible SDK 58 Expo Go client. Metro must stay running.
4. Open the counter on the phone, tap **Increment +1**, and observe a second client update. Report those device actions separately from a successful JS export or browser render.

Do not stop or replace the existing working preview during validation. Its current link/QR is maintained in the operational handoff, rather than embedding an expiring address here.

## Optional live sync check

`node check-sync.mjs` connects two independent clients and increments the **shared live demo counter once**. Run it only when that write is coordinated with the person testing the phone. Other simultaneous increments can cause its exact-value assertion to fail. It is not part of `npm run check`.

## Backend boundary

The versioned counter module and schema are only a minimal testable projection. The live development deployment retains the archived product's schema and functions. **Do not deploy this reduced checkout over that backend.** Read [backend-retention.md](../docs/backend-retention.md) for provenance and the required additive deployment process.
