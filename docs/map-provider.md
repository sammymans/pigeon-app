# Mobile map

## Decision (15 November 2026)

Use **react-native-maps 1.29.11**, the version recommended for the existing Expo SDK 58 / React Native 0.88 app. Keep Expo Go working. iOS uses Apple Maps `mutedStandard`; Android uses Google Maps with a quiet pale-blue style. The iOS palette is Apple's, not an exact reproduction of the Paper artwork. Both are native geographic maps with pan, pinch, north-up framing, annotations and route overlays. No GPS, geocoding, directions or search service is involved.

| Option | Rendering and customization | Runtime and commercial constraints |
| --- | --- | --- |
| **react-native-maps** | Native Apple/Google gestures and labels; arbitrary Google JSON styling, but Apple only supports its map types, including muted. Global map coverage; use a flat world view for flight routes, not satellite flyover. Custom pigeon image markers and dashed geographic lines are sufficient here. | Included in Expo Go on iOS/Android; no web renderer. MIT wrapper, with the underlying Apple/Google service terms and attribution. Apple native maps need no new token. Standalone Android requires a restricted Google key and a billing-enabled project. The published **Maps SDK** SKU has unlimited free usage; other Maps APIs/SKUs have separate prices. No billing account is created by this change. |
| Mapbox (`@rnmapbox/maps`) | Native vector rendering, rich style/layer control, source clustering and globe-capable underlying SDKs. Better if a single bespoke basemap/globe becomes a hard requirement. React Native wrapper capabilities must match the chosen SDK version. | Community-maintained wrapper over Mapbox's commercial SDKs; **not Expo Go**, so needs a native rebuild. Public access token and Mapbox terms/attribution/telemetry controls apply. Mobile is billed by **monthly active users** (each application/device), with 25,000 free MAUs and published volume tiers. Web needs Mapbox GL JS, separately billed by map loads (50,000 free). |
| MapLibre Native + **MapTiler Cloud** | Native vector maps, custom styles/layers and source clustering; a production tile/style service rather than the MapLibre demo tile endpoint. MapLibre GL JS is a separate web renderer with globe support; do not assume native/web globe feature parity. | MapLibre React Native is MIT, native core BSD-2-Clause; data/provider terms remain separate. **Not Expo Go**; native rebuild and a MapTiler key required. MapTiler Free is for testing/personal/non-commercial use; commercial Flex is **$30/month plus extra usage**. The published model distinguishes sessions and API requests; a third-party renderer must use the applicable request accounting, not assume MapTiler SDK session billing. Keep MapTiler/OpenStreetMap attribution as required by the selected plan/data. |

The first option meets the current mobile acceptance contract without a paid provider commitment or custom-development-client requirement. Revisit Mapbox/MapLibre only with an explicit decision to leave Expo Go and fund/operate the chosen service. The reference apps are interaction references; this decision makes no claim about their providers.

**Web is an explicit flight-list fallback**, not a fake draggable map or an unlicensed public tile server. Selection, details, send and inbox remain usable. An interactive web basemap is a separate provider/runtime decision; no second renderer is added silently.

## Setup

```sh
npm ci
npm --prefix starter ci
cd starter
npx expo install --check
npx expo start --go
```

iOS Apple Maps and Expo Go need no map key. A standalone Android build must receive `GOOGLE_MAPS_ANDROID_API_KEY` securely at build time, after approval of the Google project/billing setup. Restrict it to the Android package/signing certificate and Maps SDK for Android. `app.config.js` passes it to the native plugin; only a configured/not-configured boolean is exposed in Expo extras. Never commit a key or `.env` file. Changing the key requires rebuilding the binary. Without it, standalone Android shows a configuration message and the flight list instead of mounting an invalid Google map. Production key validity and billing must be verified on the production build.

The existing `EXPO_PUBLIC_CONVEX_URL` still determines the post-office connection. With no endpoint, the landing map remains browsable and never invents flights. Map browsing never requests location permission; denying device location cannot disable it. Native tiles need a network connection. The Apple SDK does not expose tile-load failure through this wrapper; its ready callback is not proof every tile loaded. Flight data and clock disconnection are explicitly labeled, and the independent flight list remains accessible if tiles are unavailable.

## Data and interaction contract

- `Mailbox` retains `api.flights.list` and its existing `demo` namespace behavior. My flights only uses authorized personal summaries; World uses the public Open Skies query plus the existing `visibleFlights` filter. Historical Sealed flights never enter World. No backend or schema changes are needed.
- Immutable city-coordinate snapshots are approximate game locations, not a person's current location. Great-circle routes and their moving markers use the same geometry and the existing server-anchored clock. Dateline crossings split at ±180°; fitting uses the shortest enclosing longitude arc. An unavailable clock hides moving markers instead of inventing a position. A finished countdown never changes the server's delivery state or reveals a body.
- Selecting a marker updates the bottom sheet. My flights can open the existing letter details; World selection renders summaries only, not message bodies or a new catch flow. The existing optional `onCatch(flightId)` boundary in `LetterApp`/`Mailbox` remains for the separate gameplay integration.
- Only the sheet handle captures sheet swipes. Its list scrolls independently, leaving map pan/pinch gestures to the native map. A fit button frames the selected route or all routes; an empty sky resets to a neutral world view, never GPS. Manual browsing is not reset by clock ticks.
- World currently returns at most 30 flights; My flights has a server-limited active outbound count and bounded incoming queries. No extra clustering dependency is justified for this slice. Overlapping markers can always be selected through the flight list; add source clustering if measured density warrants it.
- Native provider attribution remains visible above the sheet. The small PNG markers are rasterizations of the existing `PaperPigeon` artwork at 1×/2×/3×, not a new external asset.

## Official references

- [Expo react-native-maps compatibility and key setup](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [react-native-maps API: map types, gestures, padding and bounds](https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md)
- [Apple muted map presentation](https://developer.apple.com/videos/play/wwdc2022/10035/)
- [Google Android Maps SDK usage and billing](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing) and [SKU pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Mapbox React Native installation](https://rnmapbox.github.io/docs/install), [MAU accounting](https://docs.mapbox.com/help/glossary/monthly-active-users/) and [published pricing](https://www.mapbox.com/pricing)
- [MapLibre Expo restrictions](https://maplibre.org/maplibre-react-native/docs/setup/expo/), [wrapper license](https://github.com/maplibre/maplibre-react-native) and [MapTiler integration](https://docs.maptiler.com/react-native/)
- [MapTiler plans and usage rates](https://www.maptiler.com/cloud/pricing/)

Prices are the published model at the decision date, not a forecast of this app's bill.
