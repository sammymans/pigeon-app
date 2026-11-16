import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { FlightSummary } from '../src/domain';
import { activityProps, FlightActivityController, type ActivityDriver, type TrackedFlight } from './liveActivityModel';

const key = 'pigeon.flight-live-activity.v1';
let controller: FlightActivityController | undefined;

export function liveActivityUnavailable(): string | null {
  if (Platform.OS !== 'ios') return 'Live Activities are available in the Pigeon iPhone app.';
  if (Constants.executionEnvironment === 'storeClient') return 'Install the Pigeon development build to try Live Activities.';
  if (!requireOptionalNativeModule('ExpoWidgets')) return 'Rebuild Pigeon with Live Activities to try this flight.';
  return null;
}

function getController() {
  const unavailable = liveActivityUnavailable();
  if (unavailable) throw new Error(unavailable);
  if (!controller) {
    // Keep custom native code out of the Expo Go and browser execution paths.
    const driver: ActivityDriver = require('./PigeonFlightActivity').default;
    controller = new FlightActivityController(driver, {
      async read() {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        try {
          const value = JSON.parse(raw) as TrackedFlight;
          if (typeof value.activityId === 'string' && typeof value.flightId === 'string' && typeof value.scope === 'string' && ['test', 'preview', 'connected'].includes(value.mode) && value.props && Number.isFinite(value.props.arrivesAt)) return value;
        } catch { /* Recover by clearing orphaned native activities. */ }
        return null;
      },
      async write(value) {
        if (value) await AsyncStorage.setItem(key, JSON.stringify(value));
        else await AsyncStorage.removeItem(key);
      },
    });
  }
  return controller;
}

export async function startFlightActivity(flight: FlightSummary, scope: string, mode: 'connected' | 'preview') {
  if (liveActivityUnavailable() || flight.role !== 'sender' || flight.state !== 'in_flight') return;
  await getController().start({ flightId: flight.id, scope, mode, props: activityProps(flight) });
}

export async function startTestFlightActivity() {
  const now = Date.now();
  await getController().start({
    flightId: `test-${now}`, scope: 'test', mode: 'test',
    props: { courier: 'Clover', recipient: 'you', destination: 'Your nest', departedAt: now, arrivesAt: now + 90_000, status: 'flying', test: true },
  });
}

export async function reconcileFlightActivity(scope: string, flights?: FlightSummary[]) {
  if (liveActivityUnavailable()) return;
  await getController().reconcile(scope, flights, Date.now());
}

export async function stopFlightActivity() {
  if (liveActivityUnavailable()) return;
  await getController().stop();
}

export function liveActivityError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/disabled|not authorized|not enabled/i.test(message)) return 'Allow Live Activities in iPhone Settings → Apps → Pigeon Letters, then try again.';
  return liveActivityUnavailable() ?? 'The Live Activity could not start. Keep Pigeon open, check that Live Activities are allowed in iPhone Settings, and try again.';
}
