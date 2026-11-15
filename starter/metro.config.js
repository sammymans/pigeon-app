const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../src'), path.resolve(__dirname, '../convex')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
