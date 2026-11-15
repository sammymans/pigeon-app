import { Fit, Layout, useRive } from '@rive-app/react-webgl2';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { motionValue, RIVE_SOURCE, STATE_MACHINE, VIEW_MODEL, VIEW_MODEL_INSTANCE } from './contract';
import { StaticPigeon } from './StaticPigeon';
import type { PigeonCharacterProps } from './types';
import { useReducedMotion } from './useReducedMotion';

function BrowserRive(props: PigeonCharacterProps & { source: string; reduced: boolean }) {
  const { outfit = 'classic', size = 200, source, reduced, motion, label } = props;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const value = motionValue(motion, reduced);
  const latestValue = useRef(value);
  latestValue.current = value;
  const { rive, RiveComponent } = useRive({
    src: source,
    artboard: outfit === 'aviator' ? 'Aviator' : 'Classic',
    stateMachines: STATE_MACHINE,
    autoplay: false,
    autoBind: false,
    layout: new Layout({ fit: Fit.Contain }),
    onLoadError: () => setFailed(true),
    onRiveReady: (instance) => {
      const model = instance.viewModelByName(VIEW_MODEL)?.instanceByName(VIEW_MODEL_INSTANCE);
      const property = model?.number('motion');
      if (!model || !property) { setFailed(true); return; }
      property.value = latestValue.current;
      instance.bindViewModelInstance(model);
      instance.play(STATE_MACHINE);
      setReady(true);
    },
  });
  useEffect(() => {
    const property = rive?.viewModelInstance?.number('motion');
    if (property) property.value = value;
  }, [rive, value]);
  if (failed) return <StaticPigeon {...props} />;
  return <View style={{ width: size, height: size * 400 / 480 }} accessibilityRole="image" accessibilityLabel={label ?? `${outfit} pigeon`}>
    {!ready && <StaticPigeon {...props} />}
    <View style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0 }}>
      <RiveComponent style={{ width: '100%', height: '100%' }} aria-hidden="true" />
    </View>
  </View>;
}

export function PigeonCharacter(props: PigeonCharacterProps) {
  const reduced = useReducedMotion();
  if (!RIVE_SOURCE || reduced) return <StaticPigeon {...props} />;
  return <BrowserRive key={props.outfit ?? 'classic'} {...props} source={RIVE_SOURCE} reduced={reduced} />;
}

export default PigeonCharacter;
