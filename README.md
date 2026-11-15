# Expo + Convex foundation

One Expo Go screen and one public, reactive counter. No login, product routes, Rive, payments, or custom native modules. The frontend in `starter/` is the unchanged counter implementation already launched on Sammy's phone.

**Do not run `convex dev` or `convex deploy` against `helpful-kudu-864` from this checkout.** This is a minimal source projection, not a complete copy of that deployment. See [backend retention](docs/backend-retention.md) before any backend work.

## Install and check

Use Node 22 or newer. From the repository root:

```sh
npm ci
npm --prefix starter ci
npm run check
cd starter
npx expo install --check
```

The test uses an in-memory Convex backend. It checks initial value, singleton increments, and wraparound at one million; neither tests nor typechecks contact or deploy to cloud Convex. The two separate lockfiles keep backend test tooling out of the mobile app.

## Run

Follow [starter/README.md](starter/README.md) for cloud Metro and Expo Go. The public development endpoint is already configured; no Convex secret is needed to view the demo. Keep the existing phone preview running while validating a replacement, and do not replace its URL until a coordinated handoff.

The existing preview has a person-confirmed physical iPhone launch. That is separate from verifying increment/sync on that phone, or a standalone native build. See [the Revyl recipe](docs/revyl.md) for the latter; a recipe is not a successful build or device test.

## Source provenance

This branch projects the starter files and counter module/test from original commit `6f18957645086ba8062f028cbc801ee3fbac21ab`. The original authored commits remain unchanged in the preserved `YCCM-2-starter.bundle`; this projection is a new infrastructure commit, not an attribution rewrite. See [the retained history inventory](docs/backend-retention.md#retained-history).

`main` was initialized with the original empty ancestor `759866ca1e135554111abf794d3a8fd42bcd7438`, not with the archived full product. The implementation belongs in a reviewed feature PR.
