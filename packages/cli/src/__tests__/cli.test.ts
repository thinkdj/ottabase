import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { program } from '../cli.js';

describe('CLI Commands', () => {
    it('runs the workspace executable with current compiled output', () => {
        const result = spawnSync(process.execPath, [path.join(process.cwd(), 'bin', 'otta.mjs'), '--version'], {
            cwd: process.cwd(),
            encoding: 'utf8',
        });

        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain('1.0.0');
    });

    it('should have the generic start command', () => {
        const startCmd = program.commands.find((cmd) => cmd.name() === 'start');
        expect(startCmd).toBeDefined();
        expect(startCmd?.description()).toContain('local Wrangler environment');
        expect(startCmd?.options.find((option) => option.long === '--env')).toBeDefined();
        expect(startCmd?.options.find((option) => option.long === '--process')).toBeDefined();
        expect(startCmd?.options.find((option) => option.long === '--skip-build')).toBeDefined();
        expect(startCmd?.options.find((option) => option.long === '--dry-run')).toBeDefined();
    });

    it('should have new command', () => {
        const newCmd = program.commands.find((cmd) => cmd.name() === 'new');
        expect(newCmd).toBeDefined();
        expect(newCmd?.description()).toContain('template');
    });

    it('should have dev command', () => {
        const devCmd = program.commands.find((cmd) => cmd.name() === 'dev');
        expect(devCmd).toBeDefined();
        expect(devCmd?.description()).toContain('dev server');
    });

    it('should have a preview convenience command', () => {
        const previewCmd = program.commands.find((cmd) => cmd.name() === 'preview');
        expect(previewCmd).toBeDefined();
        expect(previewCmd?.description()).toContain('Wrangler environment');
    });

    it('should have build command', () => {
        const buildCmd = program.commands.find((cmd) => cmd.name() === 'build');
        expect(buildCmd).toBeDefined();
        expect(buildCmd?.description()).toContain('Build');
    });

    it('should have test command', () => {
        const testCmd = program.commands.find((cmd) => cmd.name() === 'test');
        expect(testCmd).toBeDefined();
        expect(testCmd?.description()).toContain('tests');
    });

    it('should have lint command', () => {
        const lintCmd = program.commands.find((cmd) => cmd.name() === 'lint');
        expect(lintCmd).toBeDefined();
        expect(lintCmd?.description()).toContain('Lint');
    });

    it('should have type-check command', () => {
        const typeCheckCmd = program.commands.find((cmd) => cmd.name() === 'type-check');
        expect(typeCheckCmd).toBeDefined();
        expect(typeCheckCmd?.description()).toContain('Type check');
    });

    it('should expose the types alias for type-check', () => {
        const typeCheckCmd = program.commands.find((cmd) => cmd.name() === 'type-check');
        expect(typeCheckCmd?.aliases()).toContain('types');
    });

    it('should have clean command', () => {
        const cleanCmd = program.commands.find((cmd) => cmd.name() === 'clean');
        expect(cleanCmd).toBeDefined();
        expect(cleanCmd?.description()).toContain('Clean');
    });

    it('should have list command', () => {
        const listCmd = program.commands.find((cmd) => cmd.name() === 'list');
        expect(listCmd).toBeDefined();
        expect(listCmd?.description()).toContain('List');
    });

    it('should expose the ls alias for list', () => {
        const listCmd = program.commands.find((cmd) => cmd.name() === 'list');
        expect(listCmd?.aliases()).toContain('ls');
    });

    it('should have info command', () => {
        const infoCmd = program.commands.find((cmd) => cmd.name() === 'info');
        expect(infoCmd).toBeDefined();
        expect(infoCmd?.description()).toContain('info');
    });

    it('should have templates command', () => {
        const templatesCmd = program.commands.find((cmd) => cmd.name() === 'templates');
        expect(templatesCmd).toBeDefined();
        expect(templatesCmd?.description()).toContain('templates');
    });

    it('test command should have watch option', () => {
        const testCmd = program.commands.find((cmd) => cmd.name() === 'test');
        const watchOption = testCmd?.options.find((opt) => opt.long === '--watch');
        expect(watchOption).toBeDefined();
    });

    it('test command should have coverage option', () => {
        const testCmd = program.commands.find((cmd) => cmd.name() === 'test');
        const coverageOption = testCmd?.options.find((opt) => opt.long === '--coverage');
        expect(coverageOption).toBeDefined();
    });

    it('lint command should have fix option', () => {
        const lintCmd = program.commands.find((cmd) => cmd.name() === 'lint');
        const fixOption = lintCmd?.options.find((opt) => opt.long === '--fix');
        expect(fixOption).toBeDefined();
    });

    it('dev command should have port option', () => {
        const devCmd = program.commands.find((cmd) => cmd.name() === 'dev');
        const portOption = devCmd?.options.find((opt) => opt.long === '--port');
        expect(portOption).toBeDefined();
    });
});
