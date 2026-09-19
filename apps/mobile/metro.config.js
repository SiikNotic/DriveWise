// Metro config for a pnpm workspace: pnpm's strict, symlinked node_modules
// layout needs a few adjustments from Metro's defaults, or it can't resolve
// `@drivewise/shared` (a workspace package living outside this app's own
// directory) or the hoisted deps at the monorepo root.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits to packages/shared trigger a Fast Refresh.
config.watchFolders = [workspaceRoot];

// Resolve modules from both this app's node_modules and the workspace root's.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm's node_modules is real symlinks (not npm/yarn's flat copy) — Metro
// needs this to follow them correctly. Hierarchical lookup must stay
// enabled (the default): pnpm scopes each package's own dependencies into
// a node_modules folder nested next to it inside .pnpm/, and only Metro's
// normal upward walk from that symlinked location finds them — disabling
// it (as an earlier version of this file did) broke resolution of any
// transitive dependency that isn't hoisted to the top-level node_modules,
// e.g. fast-base64-decode (a dependency of react-native-get-random-values).
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
