import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import type { FlightSummary } from '../domain';
import { formatDuration } from '../domain';
import { Badge, Eyebrow, Icon, Txt } from './primitives';
import { colors, mono } from './theme';
import { Bird } from './Bird';

export function Postmark({ size = 100, text = 'SENT WITH FEELING' }: { size?: number; text?: string }) {
  return <Svg width={size * 1.4} height={size} viewBox="0 0 140 100">
    <G transform="rotate(-12 50 50)" opacity={0.45} stroke="#879485" fill="none">
      <Circle cx={50} cy={50} r={41} strokeWidth={1}/><Circle cx={50} cy={50} r={34} strokeWidth={0.6}/>
      <Path d="M84 33q10-7 20 0t30 0M86 43q10-7 20 0t30 0M86 53q10-7 20 0t30 0M84 63q10-7 20 0t30 0"/>
      <SvgText x={50} y={35} fill="#607660" stroke="none" fontSize={7.2} fontWeight="700" textAnchor="middle" letterSpacing={0.7}>PIGEON POST</SvgText>
      <SvgText x={50} y={55} fill="#607660" stroke="none" fontSize={16} textAnchor="middle">✦</SvgText>
      <SvgText x={50} y={70} fill="#607660" stroke="none" fontSize={5.4} textAnchor="middle" letterSpacing={0.5}>{text}</SvgText>
    </G>
  </Svg>;
}

export function Envelope({ size = 100, open = false }: { size?: number; open?: boolean }) {
  return <Svg width={size} height={size * 0.8} viewBox="0 0 100 80" accessibilityLabel={open ? 'Opened letter' : 'Sealed letter'}>
    {open && <Path d="M8 33 50 3 92 33Z" fill="#E9DEC6" stroke="#CEBFA3"/>}
    <Rect x={8} y={26} width={84} height={49} rx={4} fill="#FFF8E8" stroke="#DACEB8"/>
    {open && <G><Rect x={20} y={14} width={60} height={49} rx={2} fill="#FFFFFF" stroke="#E9E1D1"/><Path d="M30 27h39M30 35h34M30 43h20" stroke="#C5CED2" strokeWidth={2}/></G>}
    <Path d="m9 74 33-27q8-6 16 0l33 27" fill="#FFF8E8" stroke="#DACEB8"/>
    {!open && <><Path d="m9 27 35 25q6 5 12 0l35-25" fill="#FFFDF5" stroke="#DACEB8"/><Circle cx={50} cy={52} r={8} fill={colors.coral}/><Path d="m47 52 3 2 4-5" fill="none" stroke="#FFF8E8" strokeWidth={1.2}/></>}
  </Svg>;
}

export function Segments<T extends string>({ items, value, onChange }: { items: { label: string; value: T; count?: number }[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.segments}>{items.map(item => <Pressable key={item.value} accessibilityRole="tab" aria-selected={value === item.value} accessibilityState={{ selected: value === item.value }} onPress={() => onChange(item.value)} style={[styles.segment, value === item.value && { backgroundColor: colors.white, borderColor: '#E7EBED', borderWidth: 1 }]}>
    <Txt style={{ fontSize: 12, fontWeight: value === item.value ? '700' : '500', color: value === item.value ? colors.ink : colors.muted }}>{item.label}</Txt>{item.count !== undefined && <View style={{ borderRadius: 6, backgroundColor: value === item.value ? colors.lavender : '#E8ECEE', paddingHorizontal: 6, paddingVertical: 1 }}><Txt style={{ fontSize: 10, color: value === item.value ? colors.blue : colors.muted }}>{item.count}</Txt></View>}
  </Pressable>)}</View>;
}

export function FlightStateBadge({ flight }: { flight: FlightSummary }) {
  return <Badge label={flight.state === 'delivered' ? 'Delivered' : flight.state === 'intercepted' ? 'Intercepted' : 'In flight'} tone={flight.state === 'delivered' ? 'green' : flight.state === 'intercepted' ? 'coral' : 'blue'} icon={flight.state === 'delivered' ? 'check' : flight.state === 'intercepted' ? 'flag' : 'sky'}/>;
}

export function FlightCard({ flight, now, onPress, compact = false }: { flight: FlightSummary; now: number; onPress?: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${flight.courier}: ${flight.origin.name} to ${flight.destination.name}, ${flight.state.replace('_', ' ')}`} onPress={onPress ?? (() => router.push(`/flight/${flight.id}`))} style={({ pressed }) => [styles.flightCard, { opacity: pressed ? 0.8 : 1 }, compact && { padding: 16 }]}>
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
      <View style={{ width: 68, height: 68, backgroundColor: flight.state === 'delivered' ? colors.paper : colors.sky, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>{flight.state === 'in_flight' ? <Bird size={68} outfit={flight.outfit}/> : <Envelope size={55} open={flight.state === 'delivered'}/>}</View>
      <View style={{ flex: 1, gap: 7 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Txt style={{ fontSize: 16, fontWeight: '600' }}>{flight.courier}</Txt>{flight.demo && <Badge label="Demo speed" tone="paper"/>}</View><Txt style={{ fontSize: 12, color: colors.muted }}>{flight.origin.name} <Txt style={{ color: colors.faint }}>→</Txt> {flight.destination.name}</Txt></View>
      <Icon name="chevron" size={15} color={colors.faint}/>
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 16 }}><FlightStateBadge flight={flight}/><Txt style={{ fontSize: 12, fontFamily: mono, color: colors.muted }}>{flight.state === 'in_flight' ? now >= flight.arrivesAt ? 'Confirming arrival' : `${formatDuration((flight.arrivesAt - now) / 1000)} to go` : flight.visibility === 'sealed' ? 'Sealed delivery' : 'Open Skies'}</Txt></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', alignSelf: 'flex-start', padding: 4, backgroundColor: '#EAF0F3', borderRadius: 12, gap: 3 },
  segment: { minHeight: 40, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 9, flexDirection: 'row', gap: 7, borderWidth: 1, borderColor: 'transparent' },
  flightCard: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 20 },
});
