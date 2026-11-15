# Pigeon artwork

The six Classic/Aviator still, caught, and delivered SVG/PNG poses are original Pigeon art from the project's Rive authoring handoff. They are static fallbacks, not `.riv` runtime files. `src/ui/birdArtwork.ts` contains simplified, visibility-pruned copies of the original still SVGs; the map marker changes only the original wing-group rotation for its two poses.

The land silhouettes in `src/ui/worldLand.ts` are simplified from Natural Earth's public-domain 1:110m land geometry, projected to the same equirectangular canvas as Pigeon's fixed city coordinates. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson . Simplification tolerance: 0.8 degrees. Antarctica is omitted. Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/ . The map is a stylized city-to-city illustration, not GPS tracking.
