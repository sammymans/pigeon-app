import React from 'react';
import { Pressable, View } from 'react-native';
import { cities, type CityId } from '../domain';
import { Txt } from './primitives';
import { colors } from './theme';

export function CityPicker({ value, onChange, disabled = false }: { value: CityId; onChange: (value: CityId) => void; disabled?: boolean }) {
  return <View style={{ gap: 10 }}><Txt style={{ fontSize: 12, fontWeight: '600' }}>Your home city</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{cities.map(city => <Pressable key={city.id} accessibilityRole="radio" accessibilityLabel={`${city.name}, ${city.country}`} aria-checked={value === city.id} accessibilityState={{ checked: value === city.id, disabled }} disabled={disabled} onPress={() => onChange(city.id)} style={{ borderWidth: 1, borderColor: value === city.id ? '#9BAFFB' : colors.line, backgroundColor: value === city.id ? colors.lavender : colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44 }}><Txt style={{ fontSize: 12, color: value === city.id ? colors.blue : colors.muted, fontWeight: value === city.id ? '600' : '400' }}>{city.name}</Txt></Pressable>)}</View><Txt style={{ fontSize: 11, color: colors.muted, lineHeight: 18 }}>Your game location, not your live location. No GPS or contact permissions.</Txt></View>;
}
