const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude ephemeral openai tmp directories that Metro tries to watch
// but disappear after pnpm install
config.watchFolders = (config.watchFolders ?? []);
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /node_modules\/.*_tmp_\d+\/.*/,
  /node_modules\/openai_tmp.*/,
];

module.exports = config;
