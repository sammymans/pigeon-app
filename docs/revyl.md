# Native build scope and automation

Expo Go preview, a standalone native build, and automatic Revyl PR proofs are separate results. Use Capy's cloud mobile build path, never either person's Mac or copied CLI credentials.

## Current native checkpoint: original counter only

After organization approval, build `01M7GN90AADSSMDEVJWWKDJYYH` succeeded for the **counter at foundation commit `16db591`**, from its isolated `starter/` directory. Version `c3344f81-f696-4413-9300-5103f9c1eb3c` was installed on a Revyl cloud iPhone 16. Capy observed the connected screen, tapped Increment once, and verified both the native display and an independent Convex subscription changed from 6 to 7. This is a standalone counter build/device proof, not a native build of the first-letter slice or a physical-phone test.

The counter's remote recipe is `npm ci`, `CI=1 npx expo prebuild --platform ios --no-install`, `cd ios && pod install`, then from its app root:

```sh
xcodebuild -workspace ios/ConvexStarter.xcworkspace \
  -scheme ConvexStarter -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build
```

Output: `ios/build/Build/Products/Release-iphonesimulator/ConvexStarter.app`. Do not run that recipe against this branch's renamed/shared-source frontend and claim it is the same artifact.

## First-letter packaging boundary

The letter frontend imports `../src/domain.ts` and `../convex/_generated/api`. Archiving `starter/` alone would omit those inputs. A future feature-native build must include this clean repository root (excluding dependencies, environments, runtime output and `.git`), install the starter lockfile, and prebuild from `starter/` with explicit public `EXPO_PUBLIC_CONVEX_URL`. Its app name is `Pigeon Letters`, so confirm the generated `PigeonLetters` workspace/scheme/output names. No feature-native build is claimed here. A simulator Release build embeds JS; it should not require the existing Metro or Expo token.

Install only a successful build artifact on a Revyl cloud iOS device. For the counter, tap Increment and observe another client update. For letters, use independent authenticated identities and verify private pending → server delivery → read/reply. Capture the actual result, not just the build recipe. No sign-in bypass or fake account selector should be introduced for testing.

## Next-change triggers

The GitHub workflow runs in-memory regression tests, frontend/backend TypeScript, and Expo compatibility on PRs and pushes to `main`. It does not build/launch iOS or deploy Convex. Capy can repeat an authorized build/install/interaction loop; that agent-driven run is not an automatic GitHub trigger.

Automatic Revyl Proof of Changes remains **unestablished**. No starter config was published by this work and no authenticated repository connection/enabled project state was verified. The [official setup](https://revyl.com/agent-setup/prompt.md?ref=d8202742397e625bd184031e) separately requires a real project/app ID, a proven standalone preview recipe, Revyl GitHub App access, validated/published config with both PR review and Proof of Changes enabled, and a successful `revyl github status --json` confirmation. Obtain any missing access securely; never invent IDs or publish an untested recipe.
