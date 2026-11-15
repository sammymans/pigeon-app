import type { Attempt, AttemptResult, FlightDetail } from '../../src/domain';

export type { Attempt, AttemptResult, FlightDetail };

export type CatchTransport = {
  reserve: (flightId: string) => Promise<Attempt>;
  resolve: (attemptId: string, taps: (number | null)[]) => Promise<AttemptResult>;
};

export type CatchGameProps = {
  flightId: string;
  flight: FlightDetail | null | undefined;
  connected: boolean;
  transport: CatchTransport;
  onExit: (event: { flightId: string; result: AttemptResult | null }) => void;
  flightError?: string;
  onRetryFlight?: () => void;
  onRequestConnection?: () => Promise<void>;
};
