import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../convex/_generated/api';
import type { Point } from './trajectory';

type ServerData = FunctionReturnType<typeof api.slingshot.sync>;
export type Encounter = Omit<NonNullable<ServerData['encounter']>, 'id' | 'flightId'> & { id: string; flightId: string };
export type GameData = Omit<ServerData, 'encounter'> & { encounter: Encounter | null };
export type CatchTransport = {
  sync: (flightId: string) => Promise<GameData>;
  prepare: (flightId: string) => Promise<GameData>;
  arm: (encounterId: string, armedElapsedMs: number) => Promise<GameData>;
  fire: (encounterId: string, shotKey: string, releaseElapsedMs: number, direction: Point) => Promise<GameData>;
  end: (encounterId: string) => Promise<GameData>;
};

export type CatchGameProps = {
  flightId: string;
  connected: boolean;
  transport: CatchTransport;
  onExit: (event: { flightId: string; outcome: Encounter['state'] | null }) => void;
  onOpenLetter: (event: { flightId: string }) => void;
  flightError?: string;
  onRetryFlight?: () => void;
};
