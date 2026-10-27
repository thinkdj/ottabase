// @ottabase/cli - Ottabase Monorepo CLI
// Main exports for programmatic usage

export { program, run } from './cli.js';
export {
    addPackage,
    applyAdd,
    findPackageDescriptor,
    formatAddPlan,
    planAdd,
    readPackageDescriptor,
    type AddPlan,
    type AddStep,
    type PackageDescriptor,
} from './commands/add.js';
export {
    deployApp,
    deployCommand,
    substitutePlaceholders,
    type DeployOptions,
    type DeployResult,
    type Exec,
} from './commands/deploy.js';
export {
    FOOTPRINTS_FILE,
    readFootprints,
    stripClosure,
    type Footprint,
    type Footprints,
} from './commands/footprints.js';
export { listAllApps, showAppInfo, showTemplates } from './commands/info.js';
export { newApp, scaffoldApp, type ScaffoldOptions, type ScaffoldResult } from './commands/new.js';
export { checkPreset, checkPresets, type PresetCheckResult } from './commands/preset-check.js';
export { CORE_KEYS, keysToStrip, PRESETS, presetNames, showPresets, type Preset } from './commands/presets.js';
export { proUpdate, proUpdateCommand, type ProUpdateOptions, type ProUpdateResult } from './commands/pro.js';
export {
    applyStrip,
    formatStripPlan,
    planStrip,
    stripMarkers,
    stripPackages,
    type StripPlan,
    type StripStep,
} from './commands/strip.js';
export { buildApp, cleanApp, devApp, lintApp, testApp, typeCheckApp } from './commands/run.js';
export { createStartPlan, formatStartPlan, runStartPlan, startApp, type StartOptions } from './commands/start.js';
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
