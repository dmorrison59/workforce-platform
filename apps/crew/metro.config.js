const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Installs are intentionally isolated from the web workspace. Watch only the
// two shared pure-code directories; do not pull the web dependency tree in.
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(__dirname, "../../src/core/shared"),
  path.resolve(__dirname, "../../src/modules/scheduling/lib"),
];

module.exports = config;
