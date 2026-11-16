export function formatPhoneNumber(countryCode: string, value: string): string {
  const prefix = countryCode.trim().replace(/^\+/, '');
  let digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+') && prefix && digits.startsWith(prefix)) digits = digits.slice(prefix.length);
  if (prefix !== '1') return digits;
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function phoneNumber(countryCode: string, nationalNumber: string): string | null {
  const prefix = countryCode.trim();
  if (!/^\+[1-9]\d{0,2}$/.test(prefix) || !/^[\d\s().-]+$/.test(nationalNumber)) return null;
  const phone = prefix + nationalNumber.replace(/\D/g, '');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function smsCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function resendSeconds(retryAt: number, now: number): number {
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

export function usernameValue(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function validUsername(value: string): boolean {
  return /^[a-z0-9_][a-z0-9_.]{2,23}$/.test(usernameValue(value));
}

export function onboardingRoute(loading: boolean, authenticated: boolean, status?: string): 'loading' | 'phone' | 'profile' | 'home' {
  if (loading || (authenticated && !status)) return 'loading';
  if (!authenticated || status === 'signedOut') return 'phone';
  return status === 'complete' ? 'home' : 'profile';
}
