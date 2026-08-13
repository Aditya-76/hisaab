const path = require("node:path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const workspaceRoot = path.resolve(__dirname, "../..");

/**
 * Metro in a pnpm monorepo: watch the workspace so @hisaab/core and
 * @hisaab/parsers hot-reload, and resolve through symlinks.
 * https://metrobundler.dev/docs/configuration
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [
      path.resolve(__dirname, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
