# Original pigeon runtime contract

Artboards: `Classic`, `Aviator`; fixed 480 × 400 transparent canvas, contain fit. State machine: `PigeonController`. Every displayed character owns an independent `PigeonMotion` view-model instance named `Default` with a numeric `motion` property.

| Number | Motion | Behavior |
| --- | --- | --- |
| 0 | Idle | 1.8-second loop |
| 1 | Fly | 0.8-second loop |
| 2 | Launch | 0.7-second one-shot; hold |
| 3 | Caught | 0.9-second one-shot; hold |
| 4 | Delivered | 0.7-second one-shot; hold |
| 5 | Still | Static |
| 6 | CaughtStill | Static |
| 7 | DeliveredStill | Static |

One-shots require a new actual state transition or remounted view to replay; repeating the same value is not a replay. Reduced-motion users get static PNG poses before first paint. Missing assets, load errors, unsupported native modules and Expo Go also use those original fallbacks. Small map markers use the same vector art outside Rive for predictable performance; the catch lane is entirely separate.

The source was authored with Rive CLI 1.9.2 and verified/rendered by the art workstream. The runtime adapter versions match the installed declarations; **actual binary loading, state transitions and device playback remain unverified until a real `.riv` export is provided**. Rive's login/export restriction must not be bypassed, and free-tier watermarking is acceptable. Full authoring provenance is retained in `assets/rive/ORIGIN.md` and the source contract.
