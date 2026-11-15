module.exports = ({ config }) => {
  const proxyUrl = process.env.EXPO_PACKAGER_PROXY_URL;
  if (!proxyUrl) return config;

  return {
    ...config,
    extra: {
      ...config.extra,
      router: {
        ...config.extra?.router,
        origin: new URL(proxyUrl).origin,
      },
    },
  };
};
