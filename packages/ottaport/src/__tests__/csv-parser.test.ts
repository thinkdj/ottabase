import { describe, expect, it } from 'vitest';
import { formatCsv, formatJson, formatTsv, parseCsv, parseFileContent, parseJson } from '../parsers/csv-parser';

describe('CSV Parser', () => {
    it('should parse simple CSV', () => {
        const csv = 'name,email,age\nAlice,alice@example.com,30\nBob,bob@example.com,25';
        const result = parseCsv(csv);

        expect(result.headers).toEqual(['name', 'email', 'age']);
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]).toEqual({ name: 'Alice', email: 'alice@example.com', age: '30' });
        expect(result.rows[1]).toEqual({ name: 'Bob', email: 'bob@example.com', age: '25' });
        expect(result.totalRows).toBe(2);
        expect(result.format).toBe('csv');
    });

    it('should handle quoted fields with commas', () => {
        const csv = 'name,description\n"Smith, John","A person, indeed"';
        const result = parseCsv(csv);

        expect(result.rows[0]).toEqual({ name: 'Smith, John', description: 'A person, indeed' });
    });

    it('should handle escaped quotes', () => {
        const csv = 'name,quote\nAlice,"She said ""hello"""';
        const result = parseCsv(csv);

        expect(result.rows[0]).toEqual({ name: 'Alice', quote: 'She said "hello"' });
    });

    it('should handle CRLF line endings', () => {
        const csv = 'name,email\r\nAlice,alice@test.com\r\nBob,bob@test.com';
        const result = parseCsv(csv);

        expect(result.rows).toHaveLength(2);
        expect(result.rows[0].name).toBe('Alice');
    });

    it('should skip empty rows', () => {
        const csv = 'name,email\nAlice,alice@test.com\n\nBob,bob@test.com';
        const result = parseCsv(csv);

        expect(result.rows).toHaveLength(2);
    });

    it('should handle empty CSV', () => {
        const result = parseCsv('');
        expect(result.headers).toEqual([]);
        expect(result.rows).toHaveLength(0);
    });

    it('should handle header-only CSV', () => {
        const csv = 'name,email,age';
        const result = parseCsv(csv);

        expect(result.headers).toEqual(['name', 'email', 'age']);
        expect(result.rows).toHaveLength(0);
    });

    it('should handle missing trailing fields', () => {
        const csv = 'name,email,age\nAlice,alice@test.com';
        const result = parseCsv(csv);

        expect(result.rows[0]).toEqual({ name: 'Alice', email: 'alice@test.com', age: '' });
    });
});

describe('TSV Parser', () => {
    it('should parse TSV content', () => {
        const tsv = 'name\temail\tage\nAlice\talice@example.com\t30';
        const result = parseCsv(tsv, 'tsv');

        expect(result.headers).toEqual(['name', 'email', 'age']);
        expect(result.rows[0]).toEqual({ name: 'Alice', email: 'alice@example.com', age: '30' });
        expect(result.format).toBe('tsv');
    });
});

describe('JSON Parser', () => {
    it('should parse JSON array', () => {
        const json = JSON.stringify([
            { name: 'Alice', email: 'alice@example.com', age: 30 },
            { name: 'Bob', email: 'bob@example.com', age: 25 },
        ]);
        const result = parseJson(json);

        expect(result.headers).toContain('name');
        expect(result.headers).toContain('email');
        expect(result.headers).toContain('age');
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0].name).toBe('Alice');
        expect(result.rows[0].age).toBe('30'); // Converted to string
        expect(result.format).toBe('json');
    });

    it('should handle null values', () => {
        const json = JSON.stringify([{ name: 'Alice', email: null }]);
        const result = parseJson(json);

        expect(result.rows[0].email).toBe('');
    });

    it('should handle empty array', () => {
        const result = parseJson('[]');
        expect(result.headers).toEqual([]);
        expect(result.rows).toHaveLength(0);
    });

    it('should throw for non-array JSON', () => {
        expect(() => parseJson('{"name": "Alice"}')).toThrow('JSON content must be an array of objects');
    });

    it('should collect all keys from heterogeneous objects', () => {
        const json = JSON.stringify([
            { name: 'Alice', email: 'a@b.com' },
            { name: 'Bob', phone: '1234' },
        ]);
        const result = parseJson(json);

        expect(result.headers).toContain('name');
        expect(result.headers).toContain('email');
        expect(result.headers).toContain('phone');
        expect(result.rows[0].phone).toBe('');
        expect(result.rows[1].email).toBe('');
    });
});

describe('parseFileContent', () => {
    it('should auto-dispatch to CSV parser', () => {
        const result = parseFileContent('a,b\n1,2', 'csv');
        expect(result.format).toBe('csv');
    });

    it('should auto-dispatch to TSV parser', () => {
        const result = parseFileContent('a\tb\n1\t2', 'tsv');
        expect(result.format).toBe('tsv');
    });

    it('should auto-dispatch to JSON parser', () => {
        const result = parseFileContent('[{"a":"1","b":"2"}]', 'json');
        expect(result.format).toBe('json');
    });
});

describe('CSV Formatter', () => {
    it('should format records as CSV', () => {
        const records = [
            { name: 'Alice', email: 'alice@test.com' },
            { name: 'Bob', email: 'bob@test.com' },
        ];
        const result = formatCsv(records, ['name', 'email']);

        expect(result).toBe('name,email\nAlice,alice@test.com\nBob,bob@test.com');
    });

    it('should escape commas and quotes', () => {
        const records = [{ name: 'Smith, John', quote: 'He said "hi"' }];
        const result = formatCsv(records, ['name', 'quote']);

        expect(result).toBe('name,quote\n"Smith, John","He said ""hi"""');
    });

    it('should handle null/undefined values', () => {
        const records = [{ name: 'Alice', email: null, age: undefined }];
        const result = formatCsv(records as any, ['name', 'email', 'age']);

        expect(result).toBe('name,email,age\nAlice,,');
    });
});

describe('TSV Formatter', () => {
    it('should format records as TSV', () => {
        const records = [{ name: 'Alice', email: 'alice@test.com' }];
        const result = formatTsv(records, ['name', 'email']);

        expect(result).toBe('name\temail\nAlice\talice@test.com');
    });

    it('should replace tabs in values', () => {
        const records = [{ name: 'with\ttab' }];
        const result = formatTsv(records, ['name']);

        expect(result).toBe('name\nwith tab');
    });
});

describe('JSON Formatter', () => {
    it('should format records as JSON', () => {
        const records = [{ name: 'Alice', email: 'alice@test.com' }];
        const result = formatJson(records);

        expect(JSON.parse(result)).toEqual(records);
    });

    it('should filter by fields', () => {
        const records = [{ name: 'Alice', email: 'alice@test.com', age: 30 }];
        const result = formatJson(records, ['name', 'email']);
        const parsed = JSON.parse(result);

        expect(parsed[0]).toEqual({ name: 'Alice', email: 'alice@test.com' });
        expect(parsed[0].age).toBeUndefined();
    });
});
