# Mounted messaging browser tests

This isolated Expo project renders the production Mailbox, composer, sheets, fonts, safe-area provider, and AsyncStorage through React Native Web. Its Metro resolver substitutes only `convex/react` with an explicit local fixture transport. No production entry imports these fixtures, and every rendered screen carries a test-fixture label.

Install the repository's locked dependencies, then:

```sh
npm exec playwright install chromium
npm run test:messaging-web
```

The runner links the fixture's ignored `node_modules` to the locked starter dependencies. Playwright starts its local server on port 4173. For interactive inspection, run `node tests/messaging-web/server.mjs` and open that port locally. Normal development watches source changes; CI starts a fresh non-watching server. Do not reuse a CI-mode server after editing code.

The suite covers selection, recipient change/removal, invalid text, explicit cities, anonymity/consent, unavailable birds, busy double taps, failures/reload/retry, cleanup and load failures, entry-intent consumption, pending navigation, both inbox regressions, and a 320×568 viewport. Screenshots go to `test-results/messaging-renders/`, or `MESSAGING_RENDER_DIR` when set.

These are mounted UI/interaction checks against synthetic account/transport data. They do not prove live backend dispatch, real sessions, SMS, native keyboards, or physical-device behavior. `convex/messaging.test.ts` separately exercises the real backend handlers and authorization in memory; `npm run check` includes it.
