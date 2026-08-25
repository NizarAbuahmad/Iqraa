const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `knowledge-base/` is not a workspace package, so Expo's default config does
// not watch it — but the app imports the curriculum's figure index (JSON) and
// the figure PNGs from there. Metro refuses to resolve anything outside
// projectRoot + watchFolders, so without this line every one of those imports
// fails the bundle with "None of these files exist".
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../../knowledge-base'),
];

config.resolver = config.resolver ?? {};
// Exclude ephemeral openai tmp directories that Metro tries to watch
// but disappear after pnpm install
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
