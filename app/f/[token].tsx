import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FlightDetailScreen } from '../../src/ui/FlightDetailScreen';
export default function PublicFlightScreen() { const { token } = useLocalSearchParams<{ token: string }>(); return <FlightDetailScreen id={token} publicView/>; }
