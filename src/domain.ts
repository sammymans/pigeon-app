export const cities = [
  { id: 'san-francisco', name: 'San Francisco', country: 'US', lat: 37.7749, lng: -122.4194 },
  { id: 'vancouver', name: 'Vancouver', country: 'CA', lat: 49.2827, lng: -123.1207 },
  { id: 'los-angeles', name: 'Los Angeles', country: 'US', lat: 34.0522, lng: -118.2437 },
  { id: 'new-york', name: 'New York', country: 'US', lat: 40.7128, lng: -74.006 },
  { id: 'chicago', name: 'Chicago', country: 'US', lat: 41.8781, lng: -87.6298 },
  { id: 'london', name: 'London', country: 'GB', lat: 51.5074, lng: -0.1278 },
  { id: 'paris', name: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522 },
  { id: 'berlin', name: 'Berlin', country: 'DE', lat: 52.52, lng: 13.405 },
  { id: 'tokyo', name: 'Tokyo', country: 'JP', lat: 35.6762, lng: 139.6503 },
  { id: 'seoul', name: 'Seoul', country: 'KR', lat: 37.5665, lng: 126.978 },
  { id: 'singapore', name: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198 },
  { id: 'sydney', name: 'Sydney', country: 'AU', lat: -33.8688, lng: 151.2093 },
  { id: 'sao-paulo', name: 'São Paulo', country: 'BR', lat: -23.5505, lng: -46.6333 },
] as const;

export type CityId = (typeof cities)[number]['id'];
export type City = { id: CityId; name: string; country: string; lat: number; lng: number };
export type Visibility = 'sealed' | 'open';
export type Defense = 'cruise' | 'zigzag';
export type Outfit = 'classic' | 'aviator';
export type FlightState = 'in_flight' | 'delivered' | 'intercepted';
export type FlightRole = 'sender' | 'recipient' | 'catcher' | 'public';

export type Profile = {
  id: string;
  handle: string;
  displayName?: string;
  cityId?: CityId;
  equipped: Outfit;
  demo: boolean;
};

export type FlightSummary = {
  id: string;
  pigeonId?: string;
  courier: string;
  origin: City;
  destination: City;
  visibility: Visibility;
  defense: Defense;
  distanceKm: number;
  departedAt: number;
  arrivesAt: number;
  state: FlightState;
  outfit: Outfit;
  demo: boolean;
  role: FlightRole;
  shareToken?: string;
  senderHandle?: string;
  recipientHandle?: string;
  attemptCount: number;
};

export type FlightDetail = FlightSummary & {
  body?: string;
  canCatch: boolean;
  canRequest: boolean;
  canResend: boolean;
  otherProfileId?: string;
  events: { at: number; label: string }[];
};

export type Connection = {
  id: string;
  profile: Profile;
  state: 'pending' | 'accepted' | 'declined';
  direction: 'incoming' | 'outgoing';
};

export type Attempt = {
  id: string;
  flightId: string;
  phases: number[];
  startedAt: number;
  expiresAt: number;
  serverTime: number;
  defense: Defense;
};

export type AttemptResult = {
  outcome: 'caught' | 'missed' | 'expired' | 'delivered';
  hits: boolean[];
  flightId: string;
};

export type Order = {
  id: string;
  sku: import('./shop').CommerceSku;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'reconciliation';
  purchaseUrl?: string;
  createdAt: number;
};

export type LaunchInput = {
  recipientId: string;
  pigeonId?: string;
  body: string;
  visibility: Visibility;
  defense: Defense;
  openAcknowledged: boolean;
  demo: boolean;
  requestKey: string;
};

export const LETTER_CHARACTER_LIMIT = 500;

export const OPEN_SKIES_DISCLOSURE = 'Someone may catch this pigeon, read this message, and ask to connect with you. If caught, it will not reach its recipient.';
export const CONNECTION_REQUEST = 'Your pigeon introduced us. Want to exchange letters?';

export function cityById(id: string | undefined): City {
  const city = cities.find((entry) => entry.id === id);
  if (!city) throw new Error('Choose a supported home city.');
  return city;
}

export function distanceKm(origin: City, destination: City): number {
  const radians = Math.PI / 180;
  const latitude = Math.sin((destination.lat - origin.lat) * radians / 2) ** 2;
  const longitude = Math.cos(origin.lat * radians) * Math.cos(destination.lat * radians) * Math.sin((destination.lng - origin.lng) * radians / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(latitude + longitude)));
}

export function durationSeconds(distance: number, demo: boolean, defense: Defense): number {
  const base = demo ? Math.min(90, Math.max(30, Math.ceil(distance / 60))) : Math.max(120, Math.ceil(distance / 60 * 3600));
  return Math.ceil(base * (defense === 'zigzag' ? 1.2 : 1));
}

export function catchPosition(elapsedMs: number, phase: number): number {
  return 0.5 + 0.45 * Math.sin(2 * Math.PI * elapsedMs / 1600 + phase);
}

export function isHit(elapsedMs: number, phase: number): boolean {
  return Math.abs(catchPosition(elapsedMs, phase) - 0.5) <= 0.12;
}

export function formatDuration(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(seconds));
  if (remaining >= 86400) return `${Math.floor(remaining / 86400)}d ${Math.floor(remaining % 86400 / 3600)}h`;
  if (remaining >= 3600) return `${Math.floor(remaining / 3600)}h ${Math.floor(remaining % 3600 / 60)}m`;
  if (remaining >= 60) return `${Math.floor(remaining / 60)}m ${remaining % 60}s`;
  return `${remaining}s`;
}
