import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import type { FlightSummary } from '../domain';
import { cities } from '../domain';
import { Bird } from './Bird';
import { flightProgress, project, routeGeometry, routePoint } from './flightGeometry';
import { useReducedMotion } from './primitives';
import { worldLand } from './worldLand';

export function WorldMap({ flights, now, selected, onSelect, illustrative = false, compact = false }: {
  flights: FlightSummary[]; now: number; selected?: string | null; onSelect?: (flight: FlightSummary) => void; illustrative?: boolean; compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const [flap, setFlap] = useState(false);
  useEffect(() => { if (reduced) return; const timer = setInterval(() => setFlap(value => !value), 680); return () => clearInterval(timer); }, [reduced]);
  const focus = flights.find(flight => flight.id === selected);
  const { path, start, end } = focus ? routeGeometry(focus) : { path: '', start: null, end: null };
  return <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <Svg width="100%" height="100%" viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet">
      <Defs><Pattern id="sky-grid" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse"><Path d="M60 0H0V52" stroke="#D9E9F0" strokeWidth={0.65} fill="none"/></Pattern></Defs>
      <Rect width={1000} height={520} fill="url(#sky-grid)"/>
      <G fill="#FFF9EA" stroke="#E0E6DD" strokeWidth={1.1} strokeLinejoin="round">{worldLand.map((d, i) => <Path key={i} d={d}/>)}</G>
      <G fill="#87A3B4" fontSize={7} letterSpacing={3} opacity={0.7}>
        <SvgText x={95} y={290} textAnchor="middle">PACIFIC OCEAN</SvgText><SvgText x={390} y={230} textAnchor="middle">ATLANTIC OCEAN</SvgText><SvgText x={660} y={340} textAnchor="middle">INDIAN OCEAN</SvgText>
      </G>
      <G fill="#B2BFB8">{cities.map(city => { const point = project(city.lat, city.lng); return <G key={city.id}><Circle cx={point.x} cy={point.y} r={2.4}/>{!compact && <SvgText x={point.x} y={point.y + 13} fill="#7D8F93" textAnchor="middle" fontSize={7}>{city.name.toUpperCase()}</SvgText>}</G>; })}</G>
      {focus && start && end && <G><Path d={path} fill="none" stroke="#365CF5" strokeWidth={2} strokeDasharray="4 7" opacity={0.65}/><Circle cx={start.x} cy={start.y} r={4} fill="#365CF5"/><Circle cx={end.x} cy={end.y} r={7} fill="#365CF5" opacity={0.13}/><Circle cx={end.x} cy={end.y} r={3} fill="#365CF5"/></G>}
      {illustrative && <G fill="none" stroke="#9BB2D7" strokeWidth={1.5} strokeDasharray="3 7" opacity={0.55}><Path d="M158 150Q310 7 493 111"/><Path d="M788 157Q890 210 906 334"/><Path d="M284 300Q386 181 508 233"/></G>}
    </Svg>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={() => {}}>
      <MapMarkers flights={flights} now={reduced ? Math.floor(now / 5000) * 5000 : now} selected={selected} onSelect={onSelect} illustrative={illustrative} flap={flap}/>
    </View>
  </View>;
}

function MapMarkers({ flights, now, selected, onSelect, illustrative, flap }: {
  flights: FlightSummary[]; now: number; selected?: string | null; onSelect?: (flight: FlightSummary) => void; illustrative: boolean; flap: boolean;
}) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const scale = Math.min(dimensions.width / 1000, dimensions.height / 520);
  const offsetX = (dimensions.width - 1000 * scale) / 2;
  const offsetY = (dimensions.height - 520 * scale) / 2;
  const visible = flights.filter(flight => flight.state === 'in_flight').slice(0, 30);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={event => setDimensions(event.nativeEvent.layout)}>
    {visible.map((flight, index) => {
      const point = routePoint(flight, flightProgress(flight, now));
      return <Pressable key={flight.id} accessibilityRole="button" accessibilityLabel={`${flight.courier}, ${flight.origin.name} to ${flight.destination.name}, ${flight.visibility === 'open' ? 'Open Skies' : 'Sealed'}${flight.demo ? ', Demo speed' : ''}`} aria-pressed={selected === flight.id} accessibilityState={{ selected: selected === flight.id }} onPress={() => onSelect?.(flight)}
        style={{ position: 'absolute', left: offsetX + point.x * scale - 28, top: offsetY + point.y * scale - 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: selected === flight.id ? '#FFFFFFB8' : 'transparent', borderRadius: 28, borderWidth: selected === flight.id ? 1 : 0, borderColor: '#9BB0F9' }}>
        <Bird size={54} outfit={flight.outfit} pose={flap === (index % 2 === 0) ? 'up' : 'down'} facing={flight.origin.lng > flight.destination.lng ? 'left' : 'right'}/>
      </Pressable>;
    })}
    {illustrative && [{ x: 342, y: 94, size: 75 }, { x: 793, y: 165, size: 58 }, { x: 403, y: 252, size: 52 }, { x: 181, y: 211, size: 49 }, { x: 856, y: 360, size: 57 }].map((bird, index) =>
      <View key={index} pointerEvents="none" style={{ position: 'absolute', left: offsetX + bird.x * scale - bird.size / 2, top: offsetY + bird.y * scale - bird.size * 0.4, opacity: 0.9 }}><Bird size={bird.size} pose={flap === (index % 2 === 0) ? 'up' : 'down'} outfit={index === 0 ? 'aviator' : 'classic'} label="Illustrative pigeon, not live traffic"/></View>)}
  </View>;
}
