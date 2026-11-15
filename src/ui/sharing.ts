import { Platform, Share } from 'react-native';

export async function shareLink(url: string, message: string): Promise<string> {
  if (Platform.OS === 'web') {
    if (navigator.share) {
      try { await navigator.share({ title: 'Pigeon post', text: message, url }); return 'Your sharing options are ready.'; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'Share cancelled. Your link is still here.'; throw error; }
    }
    if (!navigator.clipboard) throw new Error('Your browser cannot copy this link. Select the link below to copy it.');
    await navigator.clipboard.writeText(`${message}\n${url}`);
    return 'Link copied. Send it to your favorite human.';
  }
  await Share.share({ message: `${message}\n${url}`, url });
  return 'Your sharing options are ready.';
}
