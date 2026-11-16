# Preview coastline data

`landRings.json` is derived from [Natural Earth's 1:10m land polygons](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/), which are [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

Download the [upstream GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson), then run:

```sh
python3 scripts/generate-land-rings.py /path/to/ne_10m_land.geojson
```

The generator simplifies each ring to 0.005 degrees and encodes longitude/latitude deltas at 0.001-degree precision, using signed five-bit groups with an ASCII offset of 63. Each polygon retains its outer ring and any non-collapsed holes. `landGeometry.ts` decodes these into latitude bands for offline land checks; no runtime service or dependency is required.

This is preview geography, not navigation data. Endpoint selection checks a 1 km coastal inset to account for simplification, keeps the original flight bearing, and adjusts timing so the bird still passes near the device. If a bearing cannot reach land in both directions within a 10,000 km search, that placeholder is omitted. Inland lakes and small waterways are not represented by this coastline layer.
