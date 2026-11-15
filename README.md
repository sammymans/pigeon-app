# YCCMH

Minimal Expo / React Native TypeScript iOS foundation with Convex. No product features or authentication are configured.

## Development

Run `npm ci`, then `npm run dev` for Convex and `npm start` in another terminal for Expo. `npx convex dev --once` provisions a local backend without an account and writes an ignored `.env.local`.

The local backend URL is not reachable from a remote device. For cloud builds or a physical phone, connect a cloud Convex deployment and set `EXPO_PUBLIC_CONVEX_URL` to its public endpoint. The app launches without that variable and explicitly shows that its endpoint is unconfigured.

Run `npm run lint` for application/backend typechecks and backend lint. Convex AI guidelines are in `convex/_generated/ai/guidelines.md`; refresh them and the installed agent skills with `npx convex ai-files install`.

## Device verification

An iOS simulator build is not a signed physical-device build. Use Expo Go for a compatible SDK or an Apple-signed development build for the live phone demo. Revyl Proof of Changes additionally needs Revyl authentication, its GitHub App installation, and a published validated project configuration.
