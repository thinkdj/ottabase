import { APP_TEMPLATES, colors, getAppInfo, listApps, log } from '../utils/index.js';

/**
 * Lists all apps in the monorepo
 */
export function listAllApps(): void {
    const apps = listApps();

    if (apps.length === 0) {
        log.warn('No apps found in the monorepo.');
        return;
    }

    console.log(`\n${colors.bright}Apps in the monorepo:${colors.reset}\n`);

    for (const app of apps) {
        const typeColor = app.type === 'web' ? colors.cyan : app.type === 'landing' ? colors.magenta : colors.dim;
        const typeLabel = app.type.toUpperCase().padEnd(8);

        console.log(`  ${typeColor}[${typeLabel}]${colors.reset} ${colors.bright}${app.name}${colors.reset}`);
        console.log(`             ${colors.dim}Package: ${app.packageName}${colors.reset}`);
        console.log(`             ${colors.dim}Path: ${app.path}${colors.reset}`);

        // Show available scripts
        const scripts = Object.keys(app.scripts).filter((s) =>
            ['dev', 'build', 'test', 'lint', 'type-check'].includes(s),
        );
        if (scripts.length > 0) {
            console.log(`             ${colors.dim}Scripts: ${scripts.join(', ')}${colors.reset}`);
        }
        console.log('');
    }

    console.log(`${colors.dim}Total: ${apps.length} app(s)${colors.reset}\n`);
}

/**
 * Shows info about a specific app
 */
export function showAppInfo(appName: string): boolean {
    const app = getAppInfo(appName);

    if (!app) {
        log.error(`App "${appName}" not found.`);
        log.info('Run "otta list" to see available apps.');
        return false;
    }

    const typeColor = app.type === 'web' ? colors.cyan : app.type === 'landing' ? colors.magenta : colors.dim;

    console.log(`\n${colors.bright}App Information: ${app.name}${colors.reset}\n`);
    console.log(`  ${colors.dim}Name:${colors.reset}        ${app.name}`);
    console.log(`  ${colors.dim}Package:${colors.reset}     ${app.packageName}`);
    console.log(`  ${colors.dim}Type:${colors.reset}        ${typeColor}${app.type}${colors.reset}`);
    console.log(`  ${colors.dim}Path:${colors.reset}        ${app.path}`);

    console.log(`\n${colors.bright}Available Scripts:${colors.reset}\n`);
    for (const [name, command] of Object.entries(app.scripts)) {
        console.log(`  ${colors.cyan}${name}${colors.reset}`);
        console.log(`    ${colors.dim}${command}${colors.reset}`);
    }

    // Show dependencies count
    const depCount = Object.keys(app.dependencies).length;
    const devDepCount = Object.keys(app.devDependencies).length;
    console.log(`\n${colors.bright}Dependencies:${colors.reset}`);
    console.log(`  ${colors.dim}Runtime:${colors.reset}     ${depCount} packages`);
    console.log(`  ${colors.dim}Dev:${colors.reset}         ${devDepCount} packages`);

    // Show common commands
    console.log(`\n${colors.bright}Quick Commands:${colors.reset}\n`);
    console.log(`  ${colors.dim}otta dev ${app.name}${colors.reset}      - Start dev server`);
    console.log(`  ${colors.dim}otta build ${app.name}${colors.reset}    - Build for production`);
    console.log(`  ${colors.dim}otta test ${app.name}${colors.reset}     - Run tests`);
    console.log(`  ${colors.dim}otta lint ${app.name}${colors.reset}     - Run linter`);
    console.log('');
    return true;
}

/**
 * Shows available templates
 */
export function showTemplates(): void {
    console.log(`\n${colors.bright}Available Templates:${colors.reset}\n`);

    for (const [key, template] of Object.entries(APP_TEMPLATES)) {
        console.log(`  ${colors.cyan}${key}${colors.reset}`);
        console.log(`    ${colors.dim}${template.description}${colors.reset}`);
        console.log(`    ${colors.dim}Source: apps/${template.source}${colors.reset}`);
        console.log('');
    }

    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log(`  ${colors.dim}otta new <template> <app-name>${colors.reset}`);
    console.log(`\n${colors.bright}Examples:${colors.reset}`);
    console.log(`  ${colors.dim}otta new web my-app${colors.reset}         - Create a new web app`);
    console.log(`  ${colors.dim}otta new landing my-site${colors.reset}    - Create a new landing page`);
    console.log('');
}
