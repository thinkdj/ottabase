import { afterEach, describe, expect, it, vi } from 'vitest';
import { OttablogPlugin } from '../ottaorm-models/OttablogPlugin';
import { ottablogPluginsTable } from '../ottaorm-models/OttablogPlugin.schema';
import { OttablogTheme } from '../ottaorm-models/OttablogTheme';
import { ottablogThemesTable } from '../ottaorm-models/OttablogTheme.schema';

class TestTheme extends OttablogTheme {
    static prepare(data: Record<string, unknown>) {
        return this.prepareForDatabase(data);
    }
}

class TestPlugin extends OttablogPlugin {
    static prepare(data: Record<string, unknown>) {
        return this.prepareForDatabase(data);
    }
}

describe('Studio JSON columns', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('round-trips valid JSON through the existing TEXT storage type', () => {
        const tokens = { light: { '--brand-primary': '#123456' } };
        const config = { placement: 'after-content' };
        const preparedTheme = TestTheme.prepare({ config, tokens });
        const preparedPlugin = TestPlugin.prepare({ config });

        expect(ottablogThemesTable.tokens.getSQLType()).toBe('text');
        // OttaORM leaves objects intact; the custom Drizzle column performs
        // the only serialization step, preventing double-encoded JSON.
        expect(preparedTheme).toEqual({ config, tokens });
        expect(preparedPlugin).toEqual({ config });
        expect(ottablogThemesTable.tokens.mapToDriverValue(preparedTheme.tokens)).toBe(JSON.stringify(tokens));
        expect(ottablogThemesTable.tokens.mapFromDriverValue(JSON.stringify(tokens))).toEqual(tokens);
        expect(ottablogPluginsTable.config.mapToDriverValue(preparedPlugin.config)).toBe(JSON.stringify(config));
        expect(ottablogPluginsTable.config.mapFromDriverValue(JSON.stringify(config))).toEqual(config);
    });

    it('isolates malformed theme tokens to the affected field', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(ottablogThemesTable.tokens.mapFromDriverValue('tokens')).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('invalid JSON in tokens'));
    });

    it('isolates malformed theme and plugin config values', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(ottablogThemesTable.config.mapFromDriverValue('{bad')).toBeNull();
        expect(ottablogPluginsTable.config.mapFromDriverValue('{bad')).toBeNull();
    });
});
