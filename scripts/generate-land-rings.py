"""Build the offline preview coastline from a Natural Earth land GeoJSON file.

Usage: python3 scripts/generate-land-rings.py /path/to/ne_10m_land.geojson
Source and license: src/ui/landRings.md
"""

import json
import sys
from pathlib import Path


def simplify(points, tolerance=0.005):
    ax, ay = points[0]
    bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    denominator = dx * dx + dy * dy
    furthest, index = 0, 0
    for i, (px, py) in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / denominator)) if denominator else 0
        distance = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
        if distance > furthest:
            furthest, index = distance, i
    if furthest > tolerance * tolerance:
        return simplify(points[:index + 1])[:-1] + simplify(points[index:])
    return [points[0], points[-1]]


def encode(ring):
    previous, result = [0, 0], []
    for point in ring:
        for axis, coordinate in enumerate(point):
            value = round(round(coordinate, 3) * 1000)
            delta = value - previous[axis]
            previous[axis] = value
            delta = ~(delta << 1) if delta < 0 else delta << 1
            while delta >= 32:
                result.append(chr((32 | (delta & 31)) + 63))
                delta >>= 5
            result.append(chr(delta + 63))
    return ''.join(result)


source = json.loads(Path(sys.argv[1]).read_text())
result = []
for feature in source['features']:
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        rings = [simplify(ring) for ring in polygon]
        # Drop collapsed islands, retaining the outer ring before any holes.
        if len(rings[0]) > 3:
            result.append([encode(ring) for ring in rings if len(ring) > 3])

destination = Path(__file__).resolve().parents[1] / 'src/ui/landRings.json'
destination.write_text('[\n' + ',\n'.join(json.dumps(polygon, separators=(',', ':')) for polygon in result) + '\n]\n')
