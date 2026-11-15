import { useMutation } from 'convex/react';
import { useMemo } from 'react';
import { api } from '../../convex/_generated/api';
import type { CatchTransport } from './contract';

export function useCatchTransport(): CatchTransport {
  const sync = useMutation(api.slingshot.sync);
  const prepare = useMutation(api.slingshot.prepare);
  const arm = useMutation(api.slingshot.arm);
  const fire = useMutation(api.slingshot.fire);
  const end = useMutation(api.slingshot.end);
  return useMemo(() => ({
    sync: flightId => sync({ flightId }),
    prepare: flightId => prepare({ flightId }),
    arm: (encounterId, armedElapsedMs) => arm({ encounterId, armedElapsedMs }),
    fire: (encounterId, shotKey, releaseElapsedMs, direction) => fire({ encounterId, shotKey, releaseElapsedMs, direction }),
    end: encounterId => end({ encounterId }),
  }), [sync, prepare, arm, fire, end]);
}
