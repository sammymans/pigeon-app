import { StaticPigeon } from './StaticPigeon';
import type { PigeonCharacterProps } from './types';

export function PigeonCharacter(props: PigeonCharacterProps) {
  return <StaticPigeon {...props} />;
}

export default PigeonCharacter;
