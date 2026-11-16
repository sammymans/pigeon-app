import type { FlightSummary } from '../src/domain';

export type FlightActivityProps = {
  courier: string;
  recipient: string;
  destination: string;
  departedAt: number;
  arrivesAt: number;
  status: 'flying' | 'delivered' | 'intercepted';
  test: boolean;
};
export type TrackedFlight = {
  activityId: string;
  flightId: string;
  scope: string;
  mode: 'connected' | 'preview' | 'test';
  props: FlightActivityProps;
};
export type ActivityInstance = {
  getId(): string;
  end(policy: 'immediate' | 'default', props?: FlightActivityProps): Promise<void>;
};
export type ActivityDriver = {
  getInstances(): ActivityInstance[];
  start(props: FlightActivityProps, url: string, staleDate: Date): ActivityInstance;
};
export type ActivityStorage = {
  read(): Promise<TrackedFlight | null>;
  write(value: TrackedFlight | null): Promise<void>;
};

export function activityProps(flight: FlightSummary): FlightActivityProps {
  return {
    courier: flight.courier.slice(0, 40),
    recipient: (flight.recipientHandle ?? 'your pen pal').slice(0, 40),
    destination: flight.destination.name.slice(0, 40),
    departedAt: flight.departedAt,
    arrivesAt: flight.arrivesAt,
    status: flight.state === 'delivered' ? 'delivered' : flight.state === 'intercepted' ? 'intercepted' : 'flying',
    test: false,
  };
}

// One tracked flight at a time. Serializing operations prevents duplicate activities
// when a send, foreground refresh, and reset finish at the same time.
export class FlightActivityController {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private driver: ActivityDriver, private storage: ActivityStorage) {}

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => {});
    return next;
  }

  start(input: Omit<TrackedFlight, 'activityId'>) {
    return this.run(async () => {
      if (!Number.isFinite(input.props.departedAt) || !Number.isFinite(input.props.arrivesAt) || input.props.arrivesAt <= input.props.departedAt) {
        throw new Error('This flight has no valid arrival time.');
      }
      const current = await this.storage.read();
      const instances = this.driver.getInstances();
      if (current?.flightId === input.flightId && current.scope === input.scope && instances.some(instance => instance.getId() === current.activityId)) return;
      for (const instance of instances) await instance.end('immediate');
      await this.storage.write(null);
      const instance = this.driver.start(input.props, 'pigeon://flights', new Date(input.props.arrivesAt));
      try { await this.storage.write({ ...input, activityId: instance.getId() }); }
      catch (error) { await instance.end('immediate'); throw error; }
    });
  }

  reconcile(scope: string, flights: FlightSummary[] | undefined, now: number) {
    return this.run(async () => {
      const current = await this.storage.read();
      const instances = this.driver.getInstances();
      // Remove an orphan after a crash between native start and storage write.
      for (const instance of instances) {
        if (instance.getId() !== current?.activityId) await instance.end('immediate');
      }
      if (!current) return;
      const instance = instances.find(item => item.getId() === current.activityId);
      if (!instance) { await this.storage.write(null); return; } // Respect user dismissal.
      let status: FlightActivityProps['status'] | undefined;
      if (current.mode === 'test') {
        if (now >= current.props.arrivesAt) status = 'delivered';
      } else {
        if (flights === undefined) return; // A loading query is not an empty sky.
        const flight = current.scope === scope ? flights.find(item => item.id === current.flightId && item.role === 'sender') : undefined;
        if (!flight) { await instance.end('immediate'); await this.storage.write(null); return; }
        if (flight.state !== 'in_flight') status = activityProps(flight).status;
        else if (current.mode === 'preview' && now >= flight.arrivesAt) status = 'delivered';
        // Connected delivery is never inferred from the countdown.
      }
      if (status) {
        await instance.end('immediate', { ...current.props, status });
        await this.storage.write(null);
      }
    });
  }

  stop() {
    return this.run(async () => {
      for (const instance of this.driver.getInstances()) await instance.end('immediate');
      await this.storage.write(null);
    });
  }
}
