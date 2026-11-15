import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FlightDetailScreen } from '../../src/ui/FlightDetailScreen';
export default function FlightScreen() { const { id } = useLocalSearchParams<{ id: string }>(); return <FlightDetailScreen id={id}/>; }
