import { execSync } from 'child_process';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
}

function runCommand(command: string, ignoreError = false): string {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (error) {
        if (ignoreError) return '';
        throw error;
    }
}

/** Same auth check logic as cf:setup – wrangler whoami, empty or "not authenticated" = not logged in. */
function isAuthenticated(wranglerCmd: string): boolean {
    const whoamiResult = runCommand(`${wranglerCmd} whoami`, true);
    return !!(whoamiResult && !whoamiResult.includes('not authenticated'));
}

function main() {
    const wranglerCmd = 'pnpm --filter @ottabase/otta-web exec wrangler';

    try {
        runCommand(`${wranglerCmd} --version`);
    } catch (e) {
        log('Error: wrangler is not installed. Run "pnpm install" first.', '\x1b[31m');
        process.exit(1);
    }

    if (isAuthenticated(wranglerCmd)) {
        const whoamiResult = runCommand(`${wranglerCmd} whoami`, true);
        log(`Already logged in: ${whoamiResult.split('\n')[0]}`, GREEN);
        process.exit(0);
    }

    log('Logging in to Cloudflare...', YELLOW);
    try {
        execSync(`${wranglerCmd} login`, { stdio: 'inherit' });
    } catch (e) {
        process.exit(1);
    }
}

main();
