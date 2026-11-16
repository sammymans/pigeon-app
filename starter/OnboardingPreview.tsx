import { useState } from 'react';
import { FlockReady, PhoneOnboarding, ProfileOnboarding } from './Onboarding';
import { PreviewApp } from './page03/PreviewApp';
import type { FlockBird } from './page03/MapScreen';

const onboardingFlock: FlockBird[] = ['Mochi', 'Pip', 'Button', 'Noodle', 'Puddle'].map(name => ({ id: name.toLowerCase(), name, status: 'Ready', color: '#2453FF', speed: '60 km/h', deliveries: '0 deliveries', defense: 'No defense' }));

const skipUsernameCheck = () => {};

// All steps stay on this device. No SMS, account, or cloud session is created.
export function OnboardingPreview() {
  const [step, setStep] = useState<'phone' | 'profile' | 'ready' | 'compose'>('phone');
  const [name, setName] = useState('');

  if (step === 'phone') return <PhoneOnboarding preview sendCode={async () => ({ retryAt: 0 })} verifyCode={async () => { setStep('profile'); }} />;
  if (step === 'profile') return <ProfileOnboarding preview availability={undefined} checkUsername={skipUsernameCheck} onBack={() => setStep('phone')} complete={async values => { setName(values.displayName?.trim() || values.username); setStep('ready'); }} />;
  if (step === 'ready') return <FlockReady name={name} pigeons={onboardingFlock} onCompose={() => setStep('compose')} />;
  return <PreviewApp senderName={name} initialFlock={onboardingFlock} initialScreen={step} onRestartOnboarding={() => { setName(''); setStep('phone'); }} />;
}
