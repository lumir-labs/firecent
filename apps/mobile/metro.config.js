// Monorepo support: resolves @app/api from packages/*
const { withUniwindConfig } = require("uniwind/metro");
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// FIX monorepo + expo-dev-launcher with bun hoisted on Windows:
// the dev client requests "./node_modules/expo-router/entry" as a literal
// path; we rewrite it by resolving from the workspace.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = /^\.\/node_modules\/(.+)$/.exec(moduleName);
  if (match) {
    try {
      const resolved = require.resolve(match[1], {
        paths: [projectRoot, workspaceRoot],
      });
      return { type: "sourceFile", filePath: resolved };
    } catch {
      // fall through to normal resolution
    }
  }
  if (typeof context.previousResolveRequest === "function") {
    return context.previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  // Uniwind defaults to 16px; pinned explicitly to keep 1rem = 16px
  // (the same value we had with NativeWind v5).
  polyfills: { rem: 16 },
});
