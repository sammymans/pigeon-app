import { useMutation } from 'convex/react';
import { useMemo } from 'react';
import { api } from '../../convex/_generated/api';
import type { CatchTransport } from './contract';

export function useCatchTransport(): CatchTransport {
  const reserve = useMutation(api.flights.reserve);
  const resolve = useMutation(api.flights.resolve);
  return useMemo(() => ({
    reserve: (flightId: string) => reserve({ flightId }),
    resolve: (attemptId: string, taps: (number | null)[]) => resolve({ attemptId, taps }),
  }), [reserve, resolve]);
}
