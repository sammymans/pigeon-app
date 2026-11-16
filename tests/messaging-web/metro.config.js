const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '../..');
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.join(root, 'starter/node_modules'), path.join(root, 'node_modules')];
config.resolver.resolveRequest = (context, name, platform) => name === 'convex/react'
  ? { type: 'sourceFile', filePath: path.join(__dirname, 'transport.ts') }
  : context.resolveRequest(context, name, platform);
module.exports = config;
