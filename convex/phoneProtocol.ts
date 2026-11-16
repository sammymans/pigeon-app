import { ConvexError } from 'convex/values';

export function normalizePhone(value: unknown) {
  if (typeof value !== 'string') throw new ConvexError('Enter a phone number with its country code.');
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new ConvexError('Enter a phone number with its country code.');
  return phone;
}

export function phoneConfig() {
  const account = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (process.env.PHONE_AUTH_ENABLED !== 'true' || !account || !token || !service) {
    throw new ConvexError('Phone sign-in is not available yet. Please try again later.');
  }
  return { account, token, service };
}

export async function twilioVerify(endpoint: 'Verifications' | 'VerificationCheck', fields: Record<string, string>) {
  const { account, token, service } = phoneConfig();
  let response: Response;
  try {
    response = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/${endpoint}`, {
      method: 'POST', headers: { Authorization: `Basic ${btoa(`${account}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(), signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ConvexError('The SMS service is unavailable. Please try again later.');
  }
  if (!response.ok) {
    if (endpoint === 'VerificationCheck' && [400, 404, 429].includes(response.status)) throw new ConvexError('Invalid or expired code. Request a new code if needed.');
    throw new ConvexError('Could not send or verify the code. Please try again later.');
  }
  const result = await response.json();
  return { status: result.status as string, to: result.to as string };
}
