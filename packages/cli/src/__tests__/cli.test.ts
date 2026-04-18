import { describe, expect, it } from 'vitest';
import { program } from '../cli.js';

describe('CLI Commands', () => {
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
