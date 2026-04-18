// @ottabase/cli - Ottabase Monorepo CLI
// Main exports for programmatic usage

export { program, run } from './cli.js';
export { listAllApps, showAppInfo, showTemplates } from './commands/info.js';
export { newApp } from './commands/new.js';
export { buildApp, cleanApp, devApp, lintApp, testApp, typeCheckApp } from './commands/run.js';
export {
    APP_TEMPLATES,
    clearAppsCache,
    colors,
    findMonorepoRoot,
    getAppInfo,
    getMonorepoRoot,
    getPnpmBin,
    listApps,
    log,
    runCommand,
    runPnpmCommand,
    validateAppName,
    type AppInfo,
    type AppTemplate,
} from './utils/index.js';
