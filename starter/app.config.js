module.exports = ({ config }) => {
  const proxyUrl = process.env.EXPO_PACKAGER_PROXY_URL;
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ...(androidKey ? [['react-native-maps', { androidGoogleMapsApiKey: androidKey }]] : []),
    ],
    extra: {
      ...config.extra,
      mapsAndroidConfigured: Boolean(androidKey),
      ...(proxyUrl ? { router: {
        ...config.extra?.router,
        origin: new URL(proxyUrl).origin,
      } } : {}),
    },
  };
};
