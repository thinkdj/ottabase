import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../bin/ottabase.cjs');
const OB_PATH = path.resolve(__dirname, '../../bin/ob.cjs');

function runCli(binPath: string, args: string = ''): string {
    return execSync(`node ${binPath} ${args}`, {
        encoding: 'utf8',
        timeout: 5000,
        cwd: path.resolve(__dirname, '../../../..'),
    });
}

describe('Ottabase CLI (ottabase / ob)', () => {
    describe('--help flag', () => {
        it('should display help via ottabase --help', () => {
            const output = runCli(CLI_PATH, '--help');
            expect(output).toContain('ottabase');
            expect(output).toContain('ob');
            expect(output).toContain('Commands');
            expect(output).toContain('dev');
            expect(output).toContain('build');
            expect(output).toContain('test');
        });

        it('should display help via ob --help', () => {
            const output = runCli(OB_PATH, '--help');
            expect(output).toContain('ottabase');
            expect(output).toContain('Commands');
        });

        it('should display help via help subcommand', () => {
            const output = runCli(CLI_PATH, 'help');
            expect(output).toContain('Commands');
            expect(output).toContain('Interactive');
        });
    });

    describe('--version flag', () => {
        it('should display version via ottabase --version', () => {
            const output = runCli(CLI_PATH, '--version');
            expect(output).toMatch(/ottabase v\d+\.\d+\.\d+/);
        });

        it('should display version via ob -v', () => {
            const output = runCli(OB_PATH, '-v');
            expect(output).toMatch(/ottabase v\d+\.\d+\.\d+/);
        });

        it('should display version via version subcommand', () => {
            const output = runCli(CLI_PATH, 'version');
            expect(output).toMatch(/ottabase v\d+\.\d+\.\d+/);
        });
    });

    describe('unknown commands', () => {
        it('should exit with error for unknown command', () => {
            expect(() => runCli(CLI_PATH, 'nonexistent')).toThrow();
        });
    });

    describe('command listing', () => {
        it('should list all expected commands in help', () => {
            const output = runCli(CLI_PATH, '--help');
            const expectedCommands = [
                'dev',
                'build',
                'build:pkg',
                'test',
                'lint',
                'type-check',
                'clean',
                'clean:cache',
                'cloudflare:setup',
                'cloudflare:validate',
            ];
            for (const cmd of expectedCommands) {
                expect(output).toContain(cmd);
            }
        });
    });
});
