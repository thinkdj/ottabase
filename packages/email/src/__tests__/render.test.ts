import { beforeEach, describe, expect, it } from 'vitest';
import { renderEmail } from '../render';
import { registerEmailTemplate } from '../templates';

describe('Email rendering', () => {
    beforeEach(() => {
        // Clear any custom templates registered in previous tests
        // Note: This is a limitation - templateRegistry is not exposed for clearing
        // In a real scenario, you'd want a clearRegistry() function
    });

    it('should render email with default template', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Hello',
            content: {
                header: 'Welcome',
                body: '<p>Hi there!</p>',
                footer: 'Thanks',
            },
        });

        expect(result.subject).toBe('Hello');
        expect(result.html).toContain('Welcome');
        expect(result.html).toContain('Hi there!');
        expect(result.html).toContain('Thanks');
        expect(result.text).toBeDefined();
        expect(result.text).toContain('Welcome');
    });

    it('should substitute variables in template', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Hello {{name}}',
            variables: {
                name: 'World',
                age: 25,
            },
            content: {
                body: '<p>You are {{age}} years old</p>',
            },
        });

        expect(result.subject).toBe('Hello World');
        expect(result.html).toContain('You are 25 years old');
        expect(result.text).toContain('You are 25 years old');
    });

    it('should handle nested variables', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Hello {{user.name}}',
            variables: {
                user: {
                    name: 'Alice',
                    email: 'alice@example.com',
                },
            },
            content: {
                body: '<p>Email: {{user.email}}</p>',
            },
        });

        expect(result.subject).toBe('Hello Alice');
        expect(result.html).toContain('Email: alice@example.com');
    });

    it('should handle conditional blocks', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Test',
            variables: {
                showFooter: true,
                hideSection: false,
            },
            content: {
                body: '{{#if showFooter}}Visible{{/if}}{{#if hideSection}}Hidden{{/if}}',
            },
        });

        expect(result.html).toContain('Visible');
        expect(result.html).not.toContain('Hidden');
    });

    it('should use custom template', () => {
        const customTemplate = registerEmailTemplate({
            name: 'custom-test',
            subject: 'Custom: {{title}}',
            layout: '<html><body>{{{body}}}</body></html>',
            body: '<h1>{{title}}</h1>',
        });

        const result = renderEmail({
            template: 'custom-test',
            variables: {
                title: 'My Title',
            },
            content: {
                body: '<h1>{{title}}</h1>',
            },
        });

        expect(result.subject).toBe('Custom: My Title');
        expect(result.html).toContain('<h1>My Title</h1>');
    });

    it('should override template content with content parameter', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Test',
            content: {
                header: 'Custom Header',
                body: '<p>Custom Body</p>',
                footer: 'Custom Footer',
            },
        });

        expect(result.html).toContain('Custom Header');
        expect(result.html).toContain('Custom Body');
        expect(result.html).toContain('Custom Footer');
    });

    it('should throw error for missing template', () => {
        expect(() => {
            renderEmail({
                template: 'nonexistent-template',
                content: {
                    body: '<p>Body</p>',
                },
            });
        }).toThrow('Email template not found: nonexistent-template');
    });

    it('should throw error for missing body', () => {
        // Register a template without body
        registerEmailTemplate({
            name: 'no-body-template',
            subject: 'Test',
            // No body field
        });

        expect(() => {
            renderEmail({
                template: 'no-body-template',
                content: {},
            });
        }).toThrow('Email template requires body content.');
    });

    it('should generate text version from HTML', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Test',
            content: {
                body: '<p>Hello <strong>world</strong></p>',
            },
        });

        expect(result.text).toBeDefined();
        // stripHtml removes HTML tags and converts entities
        // The text should contain the content without HTML tags
        expect(result.text.replace(/&[^;]+;/g, '')).toContain('Hello');
        expect(result.text.replace(/&[^;]+;/g, '')).toContain('world');
        expect(result.text).not.toContain('<p>');
        expect(result.text).not.toContain('<strong>');
    });

    it('should handle HTML entities in text conversion', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Test',
            content: {
                body: '<p>Price: &euro;100</p>',
            },
        });

        expect(result.text).toContain('Price:');
    });

    it('should use template text if provided', () => {
        const template = registerEmailTemplate({
            name: 'text-template',
            subject: 'Test',
            body: '<p>HTML body</p>',
            text: 'Plain text body: {{name}}',
        });

        const result = renderEmail({
            template: 'text-template',
            variables: {
                name: 'User',
            },
            content: {
                body: '<p>HTML body</p>',
            },
        });

        expect(result.text).toBe('Plain text body: User');
        expect(result.html).toContain('HTML body');
    });

    it('should handle empty variables gracefully', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Hello {{missing}}',
            content: {
                body: '<p>{{undefined}}</p>',
            },
        });

        expect(result.subject).toBe('Hello ');
        expect(result.html).toContain('<p></p>');
    });

    it('should handle null and false values in conditionals', () => {
        const result = renderEmail({
            template: 'default',
            subject: 'Test',
            variables: {
                nullValue: null,
                falseValue: false,
                trueValue: true,
            },
            content: {
                body: '{{#if nullValue}}Null{{/if}}{{#if falseValue}}False{{/if}}{{#if trueValue}}True{{/if}}',
            },
        });

        expect(result.html).not.toContain('Null');
        expect(result.html).not.toContain('False');
        expect(result.html).toContain('True');
    });
});
