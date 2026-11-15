import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Txt, navigation } from '../../src/ui/primitives';
import { colors } from '../../src/ui/theme';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: colors.background } }} tabBar={({ state }) => width >= 760 ? null : <View style={{ flexDirection: 'row', paddingTop: 9, paddingBottom: Math.max(9, insets.bottom), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.line }}>
    {navigation.map((item, index) => <Pressable key={item.label} accessibilityRole="tab" aria-selected={state.index === index} accessibilityState={{ selected: state.index === index }} accessibilityLabel={item.label} onPress={() => router.navigate(item.route)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 48 }}><Icon name={item.icon} color={state.index === index ? colors.blue : colors.muted} size={22}/><Txt style={{ fontSize: 10, fontWeight: state.index === index ? '700' : '500', color: state.index === index ? colors.blue : colors.muted }}>{item.label}</Txt></Pressable>)}
  </View>}>
    <Tabs.Screen name="index" options={{ title: 'Sky' }}/><Tabs.Screen name="inbox" options={{ title: 'Inbox' }}/><Tabs.Screen name="nest" options={{ title: 'Nest' }}/><Tabs.Screen name="shop" options={{ title: 'Shop' }}/>
  </Tabs>;
}
