# Expo + Convex starter

One screen, one shared public demo counter. No product routes, login, Rive, payments, or custom native modules are loaded by this frontend.

## Run in the cloud

From this folder: `npm ci`, `npm run typecheck`, then `npx expo start --go --host lan --port 8081`. For an HTTPS reverse proxy, set `EXPO_PACKAGER_PROXY_URL` to that proxy's public origin before starting Metro. Confirm the iOS manifest's launch asset also uses that HTTPS origin. The preview service must stay running while the phone uses it.

Expo SDK 58 requires compatible Expo Go. On physical iOS, the CLI and Expo Go must use the same Expo account: supply `EXPO_TOKEN` securely in the cloud and verify `npx expo whoami` before claiming phone readiness. Never commit the token. Scan the public `exps://` URL's QR, open on two clients, and tap **Increment +1**. Actual phone execution requires confirmation on the device; bundle export alone does not prove it.

`node check-sync.mjs` independently connects two cloud clients, changes the counter once, and asserts the subscription receives the change.

## Backend isolation

Public endpoint: `https://helpful-kudu-864.convex.cloud` (development).

The frontend references only `starterDemo:read` and `starterDemo:increment`. Backend additions are `convex/starterDemo.ts`, its test, and the `starterDemo` table/index in `convex/schema.ts`. They access exactly one public demo row; its number wraps at one million, and callers cannot choose a table, record, or namespace. No private app records are exposed.

This reuses a development deployment containing the prior product. The complete existing schema/functions stay in the repository and deployment to preserve them and their data. They are not part of this frontend. Do not deploy a reduced schema or delete existing functions to simplify this demo.

Deployment from the parent directory requires the securely supplied key for exactly `dev:helpful-kudu-864`. Use `npx convex deploy --typecheck enable` only after checking that target; never use `--prod` or fall back to a default deployment. The starter must remain additive.
