import type { FlightSummary } from '../../src/domain';

export type FlightMapProps = {
  flights: FlightSummary[];
  selected: string | null;
  serverNow: number | null;
  scope: 'mine' | 'world';
  fitRequest: number;
  onSelect: (id: string) => void;
};
