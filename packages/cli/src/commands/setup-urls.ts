/**
 * `otta setup-urls [app] [--url <origin>] [--json]`: every URL to paste into a provider's console
 * (OAuth redirect URIs, webhook endpoints), grouped by provider.
 *
 * Built by `getSetupUrls` from `@ottabase/utils/setup-urls`, the route map the auth and postmaster
 * handlers read their paths from and the admin Setup URLs page renders, so all three agree.
 * Without `--url` it prints local, preview and production, each origin read from config:
 * local is AUTH_URL in `.env.local` / `.dev.vars`, else the primary dev URL in package.json;
 * preview and production are the custom domain route of that wrangler env block.
 */
import { getSetupUrls, type SetupUrls } from '@ottabase/utils/setup-urls';
import fs from 'fs-extra';
import path from 'path';
import { colors, resolveApp, type AppInfo } from '../utils/index.js';
import { customDomainUrl } from './deploy.js';
import { readDeployConfig } from './deploy-plan.js';

export interface SetupTarget {
    /** local, preview, production (or the app's deploy env), or `url` for --url. */
    name: string;
    origin: string | null;
    /** Why there is no origin, and what to pass instead. */
    hint?: string;
}

export interface SetupUrlsReport {
    target: string;
    urls?: SetupUrls;
    hint?: string;
}

const LOCAL_ENV_FILES = ['.env.local', '.dev.vars'];

/** `KEY=value` from a dotenv-style file (quotes stripped), or null when absent or blank. */
export function envFileValue(text: string, key: string): string | null {
    const match = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm').exec(text);
    const value = match?.[1]
        ?.trim()
        .replace(/^(['"])(.*)\1$/, '$2')
        .trim();
    return value || null;
}

/** The local origin: AUTH_URL from the app's local env files, else its primary dev process URL. */
export function localOrigin(app: AppInfo): string | null {
    for (const file of LOCAL_ENV_FILES) {
        const full = path.join(app.path, file);
        if (!fs.existsSync(full)) continue;
        const value = envFileValue(fs.readFileSync(full, 'utf8'), 'AUTH_URL');
        if (value) return value;
    }
    const start = app.ottabase.start;
    const processes = start?.development?.processes ?? [];
    return (processes.find((p) => p.primary) ?? processes[0])?.url ?? start?.worker?.url ?? null;
}

/** Local, preview and the deploy env, each with the origin its config gives, or a hint when it gives none. */
export function setupTargets(app: AppInfo): SetupTarget[] {
    const targets: SetupTarget[] = [
        {
            name: 'local',
            origin: localOrigin(app),
            hint: 'no AUTH_URL in .env.local and no dev URL in package.json: pass --url',
        },
    ];
    let wranglerFile = 'wrangler.jsonc';
    let deployEnv = 'production';
    try {
        ({ wranglerConfig: wranglerFile, wranglerEnv: deployEnv } = readDeployConfig(app.path));
    } catch {
        // No deploy manifest: the defaults are what otta deploy would use.
    }
    const wranglerPath = path.join(app.path, wranglerFile);
    const wrangler = fs.existsSync(wranglerPath) ? fs.readFileSync(wranglerPath, 'utf8') : null;
    for (const env of [...new Set(['preview', deployEnv])]) {
        targets.push({
            name: env,
            origin: wrangler ? customDomainUrl(wrangler, env) : null,
            hint: `no custom domain route in ${wranglerFile} env.${env} (the workers.dev URL is printed by otta deploy): pass --url`,
        });
    }
    return targets;
}

/** Installed package keys, as the kernel registry names them: `@ottabase/<key>` dependencies. */
export function installedPackageKeys(app: AppInfo): string[] {
    return Object.keys(app.dependencies)
        .filter((name) => name.startsWith('@ottabase/'))
        .map((name) => name.slice('@ottabase/'.length));
}

/** The report for each target: its URLs, or the hint when it has no origin. Throws on an invalid --url. */
export function buildSetupUrlsReport(app: AppInfo, url?: string): SetupUrlsReport[] {
    const packages = installedPackageKeys(app);
    const targets: SetupTarget[] = url ? [{ name: 'url', origin: url }] : setupTargets(app);
    return targets.map((target) => {
        if (!target.origin) return { target: target.name, hint: target.hint };
        try {
            return { target: target.name, urls: getSetupUrls(target.origin, { packages }) };
        } catch (error) {
            // A bad --url is the caller's mistake: fail. A bad configured origin is reported in place.
            if (url) throw error;
            return { target: target.name, hint: error instanceof Error ? error.message : String(error) };
        }
    });
}

/** Plain text, one provider block per group: label padded, value last, so a URL is easy to select. */
export function formatSetupUrls(reports: SetupUrlsReport[], appName: string): string {
    const { bright, dim, cyan, yellow, reset } = colors;
    const lines = [`\n${bright}Setup URLs for ${appName}${reset}`];
    for (const report of reports) {
        if (!report.urls) {
            lines.push('', `${bright}${report.target}${reset}  ${yellow}${report.hint}${reset}`);
            continue;
        }
        lines.push('', `${bright}${report.target}${reset}  ${cyan}${report.urls.origin}${reset}`);
        const width = Math.max(5, ...report.urls.providers.flatMap((p) => p.urls.map((u) => u.label.length)));
        for (const provider of report.urls.providers) {
            lines.push('', `  ${bright}${provider.name}${reset}  ${dim}${provider.consoleUrl}${reset}`);
            for (const url of provider.urls) {
                lines.push(`    ${url.label.padEnd(width)}  ${url.value}`);
                if (url.note) lines.push(`    ${' '.repeat(width)}  ${dim}${url.note}${reset}`);
            }
            lines.push(`    ${dim}${'needs'.padEnd(width)}  ${provider.env.join(', ')}${reset}`);
        }
    }
    lines.push('', `${dim}The same URLs, with which secrets are set: /admin/infrastructure/setup-urls${reset}`, '');
    return lines.join('\n');
}

export function setupUrlsCommand(appName: string | undefined, options: { url?: string; json?: boolean }): void {
    const app = resolveApp(appName);
    const reports = buildSetupUrlsReport(app, options.url);
    console.log(options.json ? JSON.stringify(reports, null, 2) : formatSetupUrls(reports, app.name));
}
