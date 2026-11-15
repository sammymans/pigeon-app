import { Platform } from 'react-native';

export const colors = {
  ink: '#17212B', muted: '#697A88', faint: '#98A5AF', blue: '#365CF5',
  sky: '#EAF5FF', paper: '#FFF8E8', coral: '#E97562', green: '#2F7A62',
  background: '#FAFBF9', white: '#FFFFFF', line: '#E4E9E9', lavender: '#EFF0FF',
};

export const shadow = Platform.select({
  web: { boxShadow: '0 8px 32px rgba(23, 33, 43, 0.06)' },
  default: { shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
});

export const mono = Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'monospace';
