const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve workspace packages.
config.watchFolders = [monorepoRoot];

// Resolve packages from the app's node_modules first, then the monorepo root.
// Required for pnpm workspaces where packages live in the root .pnpm store.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Follow pnpm symlinks. Without this, Metro sees the symlink target as an
// external file and refuses to bundle it, causing default-export/namespace
// confusion for ESM modules like react-native's getDevServer.
config.resolver.unstable_enableSymlinks = true;

// Prevent Metro from walking up the directory tree to find node_modules.
// Without this it can pick up the wrong version of a package from an
// ancestor directory, producing the multi-Metro-version split-bundle bug.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
