import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Component, type ReactNode } from 'react';
import { RIVE_SOURCE } from './contract';
import { StaticPigeon } from './StaticPigeon';
import type { PigeonCharacterProps } from './types';
import { useReducedMotion } from './useReducedMotion';

class RuntimeBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function NativeRuntime(props: PigeonCharacterProps & { source: string; reduced: boolean }) {
  const { PigeonRive } = require('./PigeonRive.native') as typeof import('./PigeonRive.native');
  return <PigeonRive {...props} />;
}

export function PigeonCharacter(props: PigeonCharacterProps) {
  const reduced = useReducedMotion();
  const fallback = <StaticPigeon {...props} />;
  if (!RIVE_SOURCE || reduced || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return fallback;
  return <RuntimeBoundary fallback={fallback}><NativeRuntime key={props.outfit ?? 'classic'} {...props} source={RIVE_SOURCE} reduced={reduced} /></RuntimeBoundary>;
}

export default PigeonCharacter;
