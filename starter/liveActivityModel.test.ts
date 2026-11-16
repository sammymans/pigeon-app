import { describe, expect, it, vi } from 'vitest';
import { cityById, type FlightSummary } from '../src/domain';
import { activityProps, FlightActivityController, type ActivityDriver, type ActivityInstance, type TrackedFlight } from './liveActivityModel';

const flight: FlightSummary = {
  id: 'flight-1', courier: 'Clover', recipientHandle: 'sammy', origin: cityById('london'), destination: cityById('paris'),
  departedAt: 1000, arrivesAt: 91_000, state: 'in_flight', role: 'sender', visibility: 'sealed', defense: 'cruise', outfit: 'classic', demo: true, distanceKm: 340, attemptCount: 0,
};

function setup() {
  let saved: TrackedFlight | null = null;
  let active: ActivityInstance[] = [];
  let id = 0;
  const driver: ActivityDriver = {
    getInstances: vi.fn(() => active),
    start: vi.fn(() => {
      const activityId = `native-${++id}`;
      const instance = { getId: () => activityId, end: vi.fn(async () => { active = active.filter(item => item.getId() !== activityId); }) };
      active.push(instance);
      return instance;
    }),
  };
  const storage = { read: vi.fn(async () => saved), write: vi.fn(async (value: TrackedFlight | null) => { saved = value; }) };
  const controller = new FlightActivityController(driver, storage);
  const input = { flightId: flight.id, scope: 'alice', mode: 'connected' as const, props: activityProps(flight) };
  return { controller, driver, storage, input, active: () => active, saved: () => saved };
}

describe('flight Live Activity lifecycle', () => {
  it('serializes duplicate sends and passes native countdown dates without letter content', async () => {
    const { controller, driver, input, saved } = setup();
    await Promise.all([controller.start(input), controller.start(input)]);
    expect(driver.start).toHaveBeenCalledOnce();
    expect(driver.start).toHaveBeenCalledWith(activityProps(flight), 'pigeon://flights', new Date(flight.arrivesAt));
    expect(saved()?.props).not.toHaveProperty('body');
  });

  it('recovers after app restart, waits for server delivery, and leaves loading queries alone', async () => {
    const { controller, driver, storage, input, active, saved } = setup();
    await controller.start(input);
    const end = active()[0].end;
    const reopened = new FlightActivityController(driver, storage);
    await reopened.reconcile('alice', undefined, 100_000);
    await reopened.reconcile('alice', [flight], 100_000);
    expect(end).not.toHaveBeenCalled();
    await reopened.reconcile('alice', [{ ...flight, state: 'delivered' }], 100_000);
    expect(end).toHaveBeenCalledWith('immediate', expect.objectContaining({ status: 'delivered' }));
    expect(saved()).toBeNull();
  });

  it('replaces the previous flight and cleans up on account change', async () => {
    const { controller, input, active, saved } = setup();
    await controller.start(input);
    const end = active()[0].end;
    await controller.start({ ...input, flightId: 'flight-2' });
    expect(end).toHaveBeenCalledWith('immediate');
    expect(active()).toHaveLength(1);
    await controller.reconcile('bob', [flight], 2000);
    expect(active()).toHaveLength(0);
    expect(saved()).toBeNull();
  });

  it('does not restart a Live Activity dismissed by the user', async () => {
    const { controller, driver, input, active, saved } = setup();
    await controller.start(input);
    await active()[0].end('immediate');
    await controller.reconcile('alice', [flight], 2000);
    expect(driver.start).toHaveBeenCalledOnce();
    expect(saved()).toBeNull();
  });

  it('settles test flights after returning from the background and stops interrupted flights', async () => {
    const { controller, input, active } = setup();
    await controller.start({ ...input, mode: 'test', props: { ...input.props, test: true } });
    const end = active()[0].end;
    await controller.reconcile('test', undefined, 91_000);
    expect(end).toHaveBeenCalledWith('immediate', expect.objectContaining({ status: 'delivered', test: true }));
    await controller.start(input);
    const interceptedEnd = active()[0].end;
    await controller.reconcile('alice', [{ ...flight, state: 'intercepted' }], 2000);
    expect(interceptedEnd).toHaveBeenCalledWith('immediate', expect.objectContaining({ status: 'intercepted' }));
  });

  it('cleans up when persistence fails and allows a later retry', async () => {
    const { controller, storage, input, active } = setup();
    storage.write.mockImplementationOnce(async () => {}).mockRejectedValueOnce(new Error('Disk full'));
    await expect(controller.start(input)).rejects.toThrow('Disk full');
    expect(active()).toHaveLength(0);
    await controller.start(input);
    expect(active()).toHaveLength(1);
    await controller.stop();
    expect(active()).toHaveLength(0);
  });
});
