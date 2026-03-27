#!/usr/bin/env node
/**
 * Cross-platform script to kill processes on ports 3003 and 3004.
 * Used to clean up stuck dev server processes.
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
}

const PORTS = [3003, 3004];
const isWindows = process.platform === 'win32';

async function killPortUnix(port: number): Promise<void> {
    try {
        // Find PIDs using the port
        const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || true`);
        const pids = stdout
            .trim()
            .split('\n')
            .filter((pid) => pid);

        if (pids.length === 0) {
            log(`  Port ${port}: No process found`, YELLOW);
            return;
        }

        // Kill all PIDs
        for (const pid of pids) {
            try {
                await execAsync(`kill -9 ${pid}`);
                log(`  Port ${port}: Killed process ${pid}`, GREEN);
            } catch (err) {
                log(`  Port ${port}: Failed to kill process ${pid}`, RED);
            }
        }
    } catch (err) {
        log(`  Port ${port}: Error checking port (${err})`, RED);
    }
}

async function killPortWindows(port: number): Promise<void> {
    try {
        // Find PIDs using the port
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.trim().split('\n');

        const pids = new Set<string>();
        for (const line of lines) {
            // Extract PID from the last column
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(Number(pid))) {
                pids.add(pid);
            }
        }

        if (pids.size === 0) {
            log(`  Port ${port}: No process found`, YELLOW);
            return;
        }

        // Kill all PIDs
        for (const pid of pids) {
            try {
                await execAsync(`taskkill /PID ${pid} /F`);
                log(`  Port ${port}: Killed process ${pid}`, GREEN);
            } catch (err) {
                log(`  Port ${port}: Failed to kill process ${pid}`, RED);
            }
        }
    } catch (err) {
        // No output might mean port is not in use
        log(`  Port ${port}: No process found`, YELLOW);
    }
}

async function killPort(port: number): Promise<void> {
    if (isWindows) {
        await killPortWindows(port);
    } else {
        await killPortUnix(port);
    }
}

async function main() {
    log('');
    log(`${BOLD}Killing processes on dev server ports...${NC}`, YELLOW);
    log('');

    for (const port of PORTS) {
        await killPort(port);
    }

    log('');
    log(`${BOLD}Done!${NC}`, GREEN);
    log('');
}

main().catch((err) => {
    log(`${BOLD}Error:${NC} ${err.message}`, RED);
    process.exit(1);
});
