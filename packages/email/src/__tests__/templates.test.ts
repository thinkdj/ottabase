import { beforeEach, describe, expect, it } from 'vitest';
import { getEmailTemplate, listEmailTemplates, registerEmailTemplate } from '../templates';
import type { EmailTemplate } from '../types';

describe('Email template registry', () => {
    beforeEach(() => {
        // Note: In a real implementation, you'd want a clearRegistry() function
        // For now, we'll work with the existing registry state
    });

    it('should register a template', () => {
        const template: EmailTemplate = {
            name: 'test-template',
            subject: 'Test Subject',
            body: '<p>Test body</p>',
        };

        const registered = registerEmailTemplate(template);
        expect(registered).toBe(template);
    });

    it('should retrieve a registered template', () => {
        const template: EmailTemplate = {
            name: 'retrievable-template',
            subject: 'Retrievable',
            body: '<p>Body</p>',
        };

        registerEmailTemplate(template);
        const retrieved = getEmailTemplate('retrievable-template');

        expect(retrieved).toBe(template);
        expect(retrieved?.name).toBe('retrievable-template');
        expect(retrieved?.subject).toBe('Retrievable');
    });

    it('should return undefined for non-existent template', () => {
        const retrieved = getEmailTemplate('nonexistent-template-12345');
        expect(retrieved).toBeUndefined();
    });

    it('should list all registered templates', () => {
        const templates = listEmailTemplates();
        expect(Array.isArray(templates)).toBe(true);
        expect(templates).toContain('default'); // Default template should exist
    });

    it('should include newly registered templates in list', () => {
        const initialCount = listEmailTemplates().length;

        registerEmailTemplate({
            name: 'new-list-template',
            subject: 'New',
            body: '<p>New</p>',
        });

        const templates = listEmailTemplates();
        expect(templates.length).toBeGreaterThanOrEqual(initialCount);
        expect(templates).toContain('new-list-template');
    });

    it('should allow overriding existing templates', () => {
        const original: EmailTemplate = {
            name: 'override-template',
            subject: 'Original',
            body: '<p>Original</p>',
        };

        registerEmailTemplate(original);
        expect(getEmailTemplate('override-template')?.subject).toBe('Original');

        const updated: EmailTemplate = {
            name: 'override-template',
            subject: 'Updated',
            body: '<p>Updated</p>',
        };

        registerEmailTemplate(updated);
        expect(getEmailTemplate('override-template')?.subject).toBe('Updated');
    });

    it('should handle template with all fields', () => {
        const fullTemplate: EmailTemplate = {
            name: 'full-template',
            subject: '{{subject}}',
            layout: '<html><body>{{{body}}}</body></html>',
            header: '{{header}}',
            body: '{{{body}}}',
            footer: '{{footer}}',
            text: '{{text}}',
        };

        registerEmailTemplate(fullTemplate);
        const retrieved = getEmailTemplate('full-template');

        expect(retrieved).toEqual(fullTemplate);
    });

    it('should have default template registered', () => {
        const defaultTemplate = getEmailTemplate('default');
        expect(defaultTemplate).toBeDefined();
        expect(defaultTemplate?.name).toBe('default');
        expect(defaultTemplate?.subject).toBeDefined();
        expect(defaultTemplate?.layout).toBeDefined();
    });
});
