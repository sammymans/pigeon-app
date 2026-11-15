import type { Outfit } from '../domain';

export type PigeonCharacterProps = {
  size?: number;
  outfit?: Outfit;
  motion?: 'idle' | 'fly' | 'launch' | 'celebrate' | 'caught' | 'delivered';
  label?: string;
};
