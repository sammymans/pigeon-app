import type { City, Outfit } from '../../src/domain';

export type TripStatus = 'outbound' | 'held' | 'returning' | 'returned';
export type TripView = {
  id: string;
  flightId: string;
  currentFlightId: string;
  status: TripStatus;
  role: 'owner' | 'holder';
  courier: { key: string; slot: number; name: string; outfit: Outfit };
  ownerHandle: string;
  home: City;
  holderKind?: 'recipient' | 'catcher';
  replyDeadline: number | null;
  canReturn: boolean;
  blocked: boolean;
  demo: boolean;
  returnOrigin: City;
  returnSeconds: number;
  normalReturnSeconds: number;
  departedAt?: number;
  arrivesAt?: number;
  returnedAt?: number;
  returnKind?: 'reply' | 'empty';
  updatedAt: number;
};

export type OpenLetter = { trip: TripView; body?: string; authorHandle: string; origin: City; serverTime: number };
export type ReturnInput = { flightId: string; requestKey: string; body?: string; openAcknowledged?: boolean };
export type ReturnReceipt = { tripId: string; flightId: string; status: 'returning' | 'returned'; kind: 'reply' | 'empty'; expired: boolean };
