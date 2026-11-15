import type { PigeonCharacterProps } from './types';

export const RIVE_SOURCE = process.env.EXPO_PUBLIC_PIGEON_RIVE_URL;
export const STATE_MACHINE = 'PigeonController';
export const VIEW_MODEL = 'PigeonMotion';
export const VIEW_MODEL_INSTANCE = 'Default';

export function motionValue(motion: PigeonCharacterProps['motion'], reduced: boolean): number {
  if (reduced) return motion === 'caught' ? 6 : motion === 'delivered' || motion === 'celebrate' ? 7 : 5;
  switch (motion) {
    case 'fly': return 1;
    case 'launch': return 2;
    case 'caught': return 3;
    case 'celebrate':
    case 'delivered': return 4;
    default: return 0;
  }
}
