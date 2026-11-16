import landRings from './landRings.json';

type Coordinate = { latitude: number; longitude: number };
type Edge = { x1: number; y1: number; x2: number; y2: number };

// Natural Earth coastlines, simplified to 0.005° and encoded at 0.001° precision.
// Index edges by latitude so checking nearby endpoints doesn't scan the world.
const latitudeBands = new Map<number, Edge[]>();
for (const polygon of landRings) {
  for (const ring of polygon) {
    const points: number[][] = [];
    let offset = 0, longitude = 0, latitude = 0;
    const delta = () => {
      let value = 0, shift = 0, byte: number;
      do {
        byte = ring.charCodeAt(offset++) - 63;
        value |= (byte & 31) << shift;
        shift += 5;
      } while (byte >= 32);
      return value & 1 ? ~(value >>> 1) : value >>> 1;
    };
    while (offset < ring.length) {
      longitude += delta(); latitude += delta();
      points.push([longitude / 1000, latitude / 1000]);
    }
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1], [x2, y2] = points[i];
      if (y1 === y2) continue;
      const edge = { x1, y1, x2, y2 };
      for (let band = Math.floor(Math.min(y1, y2)); band <= Math.floor(Math.max(y1, y2)); band++) {
        if (!latitudeBands.has(band)) latitudeBands.set(band, []);
        latitudeBands.get(band)!.push(edge);
      }
    }
  }
}

export function isLandCoordinate({ latitude, longitude }: Coordinate) {
  let inside = false;
  for (const { x1, y1, x2, y2 } of latitudeBands.get(Math.floor(latitude)) ?? []) {
    if ((y1 > latitude) !== (y2 > latitude)
      && longitude < (x2 - x1) * (latitude - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}
