# Standalone iOS build lane

Expo Go phone access and a Revyl standalone simulator build are separate checks. Use Capy's cloud mobile build path, not either person's Mac or a copied CLI key. A Revyl organization admin must approve Capy's connection before upload/build; a `REVYL_API_KEY` alone does not grant that approval.

The single attempt from the verified Sammy-owned thread on November 15, 2026 was refused for that pending approval before upload. There is no build ID, artifact, installed simulator app, or native test from this attempt. This recipe has not yet run on the native builder.

Archive only `starter/` as the build workspace. Its `.capyignore` excludes local environment files; the endpoint is already public source configuration. No Expo token or Convex deploy key is required for an unsigned simulator build.

Commands on the remote macOS build runner:

```sh
npm ci
CI=1 npx expo prebuild --platform ios --no-install
cd ios && pod install
```

Then, from the archived app root:

```sh
xcodebuild -workspace ios/ConvexStarter.xcworkspace \
  -scheme ConvexStarter -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build
```

Expected output: `ios/build/Build/Products/Release-iphonesimulator/ConvexStarter.app`. Release embeds JavaScript rather than depending on the phone's existing Metro. Expo generates the workspace/scheme from the app name; confirm those names in prebuild output before interpreting a build failure.

Install a successful artifact on a Revyl cloud iOS device, launch it, and verify the counter interaction. Until an actual build ID, artifact, and device result exist, do not claim native validation. If the platform refuses for pending organization approval, an admin must open **Settings → Integrations → Revyl** and approve the Capy connection in Revyl; do not retry in a loop or bypass that approval through the CLI.

## What runs on the next change

The included GitHub Actions workflow runs the in-memory counter regression test, frontend/backend TypeScript checks, and Expo dependency compatibility on pull requests and pushes to `main`. It does not build or launch iOS, contact Convex, or invoke Revyl.

Once approval is resolved, Capy can repeat the cloud build recipe above for the changed starter, install the returned artifact on a cloud iOS device, read the counter, tap Increment, verify an independent Convex subscription observes the same update, and attach screenshots/logs. This is an agent-driven execution on request, not an automatic GitHub PR trigger. Coordinate the shared counter write with the phone tester; do not restart their Metro.

## Revyl Proof of Changes is a separate setup

No `.revyl/config.yaml` has been published for this starter by this work, and the Revyl GitHub App's repository connection and enabled project status have not been verified under this thread's account. **Automatic Revyl PR proofs are not established.** A successful manual build would not change that claim.

The [official setup instructions](https://revyl.com/agent-setup/prompt.md?ref=d8202742397e625bd184031e) require authenticated CLI configuration for the `starter/` project root, a real project/app ID, a successful standalone `preview` build recipe, repository access through the Revyl GitHub App, and validated/published configuration with both `pr_review.enabled` and `pr_review.proof_of_changes.enabled` set to true. Confirm with `revyl github status --json` that the repository is connected and `project.status` is `enabled`, as well as the published Proof of Changes flag. Obtain missing credentials securely; never copy them from an old owner's thread. The native build itself continues through Capy's required build path.

The starter has no sign-in screen, so no auth bypass, test account, or backend auth change is needed for counter proofs. Do not invent project/app IDs or publish an untested build recipe merely to show the integration as enabled.
