import { Fit, RiveView, useRiveFile, useRiveNumber, useViewModelInstance } from '@rive-app/react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { motionValue, STATE_MACHINE, VIEW_MODEL, VIEW_MODEL_INSTANCE } from './contract';
import { StaticPigeon } from './StaticPigeon';
import type { PigeonCharacterProps } from './types';

export function PigeonRive(props: PigeonCharacterProps & { source: string; reduced: boolean }) {
  const { size = 200, outfit = 'classic', motion, source, reduced, label } = props;
  const [failed, setFailed] = useState(false);
  const value = motionValue(motion, reduced);
  const { riveFile, error } = useRiveFile(source);
  const { instance, error: bindingError } = useViewModelInstance(riveFile, {
    viewModelName: VIEW_MODEL,
    instanceName: VIEW_MODEL_INSTANCE,
    onInit: (model) => model.numberProperty('motion')?.set(value),
  });
  const { setValue } = useRiveNumber('motion', instance);
  useEffect(() => { setValue(value); }, [setValue, value]);
  if (failed || error || bindingError || !riveFile || !instance) return <StaticPigeon {...props} />;
  return <View accessibilityRole="image" accessibilityLabel={label ?? `${outfit} pigeon`} style={{ width: size, height: size * 400 / 480 }}>
    <RiveView file={riveFile} dataBind={instance} artboardName={outfit === 'aviator' ? 'Aviator' : 'Classic'} stateMachineName={STATE_MACHINE} fit={Fit.Contain} autoPlay frameRate={30} onError={() => setFailed(true)} style={{ flex: 1 }} />
  </View>;
}
