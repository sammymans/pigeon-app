# Pigeon flight Live Activity

Pigeon uses Expo SDK 58, `expo-dev-client`, `expo-widgets`, and `@expo/ui`. The widget config plugin generates the ActivityKit extension during prebuild. Expo Go and the browser continue to work; they show the test as unavailable and never load the native widget module.

## Try it on an iPhone

1. Install the signed **development** build from the project's internal distribution link. No cable is required for EAS internal distribution. The Apple developer team needs an active membership, and the iPhone must be registered before building.
2. Enable Developer Mode on the iPhone if requested.
3. Start Metro from `starter/` with `npm run start:dev` on the same network, or use `npx expo start --dev-client --tunnel`. Scan that development-client QR after the Pigeon app is installed.
4. Finish the local onboarding preview, open the map's Settings menu, and choose **Test Live Activity · 90 sec**.
5. Lock the phone to see Clover's countdown, or leave Pigeon to see the Dynamic Island. Long-press the Island to expand it. **Stop Live Activity** removes the running test. The test sends no real letter.
6. Sending a normal preview or connected letter starts tracking that outgoing flight. A new send replaces the previous tracked flight. The activity contains only the courier, recipient display name, destination city, and ETA; it never includes the letter body.

The development profile keeps the current local onboarding preview enabled. Connected mode requires starting Metro with `EXPO_PUBLIC_ONBOARDING_PREVIEW=false` and the existing public Convex deployment URL.

## Build commands

Run inside `starter/` with a supported Node version (22.13+; the EAS profile pins 22.16):

```sh
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

The device-registration command provides a URL to open in Safari on the iPhone. Complete Apple sign-in and 2FA in your own terminal or browser when EAS requests it; never commit signing files.

For the simulator, no Apple membership is needed:

```sh
npx expo run:ios
```

Or use `eas build --platform ios --profile development-simulator` for a cloud simulator build. Simulator builds cannot be installed on physical iPhones. Native dependency/config changes require a new binary; TypeScript UI changes can use Metro.

## Lifecycle and limits

- The arrival countdown uses SwiftUI `Text.timerInterval`, rendered by iOS. It keeps ticking while the app is suspended and stops at zero. No per-second JavaScript or network updates drive the widget.
- At the ETA, ActivityKit's stale state makes a test say **Test flight arrived**. A real flight says **Checking arrival** until the app receives the authoritative delivered/intercepted state. Opening the activity opens Pigeon.
- A native activity ID and minimal flight metadata are saved locally. Returning to the app reconciles the active instance; it does not recreate an activity the user dismissed. New sends, preview reset, and sign-out clean up the previous activity.
- Real server-confirmed delivery while the app stays closed is **not implemented**. That requires storing per-activity APNs tokens and sending ActivityKit updates/end events from the backend. This build does not request push entitlements.
- iOS limits an active Live Activity to eight hours. Pigeon's long-distance flights may exceed that; this prototype is not an always-on tracker for multi-day flights. A production version should start tracking near arrival or use ordinary notifications for those flights.

## Validation

`starter/liveActivityModel.test.ts` exercises duplicate sends, recovery after restart, server-authoritative arrival, account changes, user dismissal, test completion, interception, and persistence failure cleanup. Run the starter suite with `npx vitest run --config starter/vitest.config.ts` from the repository root, and run `npm --prefix starter run typecheck`.

References: [Expo Widgets](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [ActivityKit constraints](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities).
