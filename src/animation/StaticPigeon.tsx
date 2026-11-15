import { Image } from 'react-native';
import type { PigeonCharacterProps } from './types';

const art = {
  classic: {
    still: require('../../assets/pigeon/classic-still.png'),
    caught: require('../../assets/pigeon/classic-caught.png'),
    delivered: require('../../assets/pigeon/classic-delivered.png'),
  },
  aviator: {
    still: require('../../assets/pigeon/aviator-still.png'),
    caught: require('../../assets/pigeon/aviator-caught.png'),
    delivered: require('../../assets/pigeon/aviator-delivered.png'),
  },
};

export function StaticPigeon({ outfit = 'classic', motion = 'idle', size = 200, label }: PigeonCharacterProps) {
  const pose = motion === 'caught' ? 'caught' : motion === 'delivered' || motion === 'celebrate' ? 'delivered' : 'still';
  return <Image source={art[outfit][pose]} resizeMode="contain" style={{ width: size, height: size * 400 / 480 }} accessibilityLabel={label ?? `${outfit === 'aviator' ? 'Aviator' : 'Classic'} pigeon`} />;
}
