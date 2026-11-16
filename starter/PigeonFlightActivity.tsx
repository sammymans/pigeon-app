import { HStack, Image, Overlay, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { fixedSize, font, foregroundStyle, hidden, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { FlightActivityProps } from './liveActivityModel';

export default createLiveActivity('PigeonFlight', (props: FlightActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const blue = environment.colorScheme === 'dark' || environment.isLuminanceReduced ? '#9DB5FF' : '#2453FF';
  const arrived = props.status === 'delivered' || (props.test && environment.isStale);
  const waiting = props.status === 'flying' && environment.isStale && !props.test;
  const intercepted = props.status === 'intercepted';
  const title = arrived ? (props.test ? 'Test flight arrived' : 'Letter delivered') : intercepted ? 'Flight intercepted' : waiting ? 'Checking arrival' : `${props.courier} is flying`;
  const symbol = arrived ? 'envelope.badge.fill' : intercepted ? 'envelope.fill' : 'bird.fill';
  const lower = new Date(props.departedAt);
  const upper = new Date(props.arrivesAt);
  const seconds = Math.ceil((props.arrivesAt - props.departedAt) / 1000);
  const placeholder = seconds >= 360000 ? '000:00:00' : seconds >= 36000 ? '00:00:00' : seconds >= 3600 ? '0:00:00' : seconds >= 600 ? '00:00' : '0:00';
  const timer = (
    <Overlay modifiers={[monospacedDigit(), fixedSize({ horizontal: true, vertical: false })]}>
      <Text modifiers={[hidden()]}>{placeholder}</Text>
      <Overlay.Content><Text timerInterval={{ lower, upper }} countsDown /></Overlay.Content>
    </Overlay>
  );
  const finished = arrived || intercepted;
  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={10}>
          <Image systemName={symbol} color={blue} size={26} />
          <VStack alignment="leading" spacing={3}>
            <Text modifiers={[font({ size: 16, weight: 'semibold' }), lineLimit(1)]}>{title}</Text>
            <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{props.test ? 'Pigeon · 90-second test' : `To ${props.recipient} · ${props.destination}`}</Text>
          </VStack>
          <Spacer />
          {!finished && !waiting ? <VStack alignment="trailing" spacing={3} modifiers={[foregroundStyle(blue)]}>{timer}<Text modifiers={[font({ size: 10 })]}>ARRIVAL</Text></VStack> : null}
        </HStack>
        <Text modifiers={[font({ size: 11 })]}>{waiting ? 'Open Pigeon to confirm delivery.' : arrived ? 'A little hello has landed.' : intercepted ? 'Open Pigeon for flight details.' : props.test ? 'Lock your phone. This countdown keeps flying.' : 'Estimated arrival · tap to open Pigeon'}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName={symbol} color={blue} size={18} />,
    compactTrailing: finished ? <Image systemName={arrived ? 'checkmark' : 'exclamationmark'} color={blue} size={14} /> : waiting ? <Text>…</Text> : timer,
    minimal: <Image systemName={symbol} color={blue} size={16} />,
    expandedLeading: <Image systemName={symbol} color={blue} size={30} />,
    expandedTrailing: !finished && !waiting ? timer : <Text>{arrived ? 'Arrived' : intercepted ? 'Caught' : 'Checking…'}</Text>,
    expandedBottom: <VStack alignment="leading" spacing={4}><Text modifiers={[font({ weight: 'semibold' }), lineLimit(1)]}>{title}</Text><Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{props.test ? 'Pigeon test flight' : `To ${props.recipient} · ${props.destination}`}</Text>{waiting ? <Text modifiers={[font({ size: 11 })]}>Open Pigeon to confirm delivery.</Text> : null}</VStack>,
  };
});
