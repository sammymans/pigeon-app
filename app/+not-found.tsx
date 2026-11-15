import React from 'react';
import { router } from 'expo-router';
import { Button, EmptyState, Page } from '../src/ui/primitives';
export default function NotFound() { return <Page narrow><EmptyState title="This bird took a wrong turn." body="There’s no post office at this address. Let’s get you back to the sky." action={<Button label="Back to the sky" onPress={() => router.replace('/')}/>}/></Page>; }
