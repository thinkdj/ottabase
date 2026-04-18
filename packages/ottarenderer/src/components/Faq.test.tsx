import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import React from 'react';
import Faq from './Faq';

describe('Faq Renderer', () => {
    // ── Null / empty guards ────────────────────────────────────────────────────

    it('should render null for undefined data', () => {
        const { container } = render(<Faq data={undefined as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render null when all questions are empty', () => {
        const { container } = render(
            <Faq data={{ items: [{ question: '', answer: 'Something' }], style: 'accordion' }} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('should render null when items array is empty', () => {
        const { container } = render(<Faq data={{ items: [], style: 'accordion' }} />);
        expect(container.firstChild).toBeNull();
    });

    // ── Accordion style ────────────────────────────────────────────────────────

    describe('Accordion style (default)', () => {
        it('should render a <details> element per item', () => {
            const { container } = render(
                <Faq
                    data={{
                        style: 'accordion',
                        items: [
                            { question: 'What is this?', answer: 'It is great.' },
                            { question: 'How much?', answer: 'Free.' },
                        ],
                    }}
                />,
            );
            const details = container.querySelectorAll('details');
            expect(details).toHaveLength(2);
        });

        it('should render question text inside <summary>', () => {
            render(
                <Faq
                    data={{
                        style: 'accordion',
                        items: [{ question: 'What is ottabase?', answer: 'A platform.' }],
                    }}
                />,
            );
            expect(screen.getByText('What is ottabase?')).toBeTruthy();
        });

        it('should render answer text', () => {
            render(
                <Faq
                    data={{
                        style: 'accordion',
                        items: [{ question: 'Q', answer: 'This is the answer.' }],
                    }}
                />,
            );
            expect(screen.getByText('This is the answer.')).toBeTruthy();
        });

        it('should skip items with empty questions', () => {
            const { container } = render(
                <Faq
                    data={{
                        style: 'accordion',
                        items: [
                            { question: '', answer: 'No question, skip me.' },
                            { question: 'Real Q', answer: 'Real A.' },
                        ],
                    }}
                />,
            );
            const details = container.querySelectorAll('details');
            expect(details).toHaveLength(1);
        });

        it('should have aria-label on the section', () => {
            const { container } = render(
                <Faq data={{ style: 'accordion', items: [{ question: 'Q', answer: 'A' }] }} />,
            );
            const section = container.querySelector('section');
            expect(section?.getAttribute('aria-label')).toBe('Frequently asked questions');
        });
    });

    // ── Flat style ─────────────────────────────────────────────────────────────

    describe('Flat style', () => {
        it('should render <h3> elements for questions', () => {
            const { container } = render(
                <Faq
                    data={{
                        style: 'flat',
                        items: [
                            { question: 'Q1', answer: 'A1' },
                            { question: 'Q2', answer: 'A2' },
                        ],
                    }}
                />,
            );
            const headings = container.querySelectorAll('h3');
            expect(headings).toHaveLength(2);
        });

        it('should NOT use <details> elements in flat mode', () => {
            const { container } = render(
                <Faq
                    data={{
                        style: 'flat',
                        items: [{ question: 'Q', answer: 'A' }],
                    }}
                />,
            );
            expect(container.querySelectorAll('details')).toHaveLength(0);
        });
    });

    // ── Structured data ────────────────────────────────────────────────────────

    describe('FAQPage structured data', () => {
        it('should emit application/ld+json script tag', () => {
            const { container } = render(
                <Faq
                    data={{
                        style: 'accordion',
                        items: [{ question: 'Does it work?', answer: 'Yes.' }],
                    }}
                />,
            );
            const script = container.querySelector('script[type="application/ld+json"]');
            expect(script).toBeTruthy();
            const json = JSON.parse(script!.innerHTML);
            expect(json['@type']).toBe('FAQPage');
            expect(json.mainEntity).toHaveLength(1);
            expect(json.mainEntity[0].name).toBe('Does it work?');
        });
    });

    // ── className passthrough ──────────────────────────────────────────────────

    it('should apply extra className to section', () => {
        const { container } = render(
            <Faq data={{ style: 'accordion', items: [{ question: 'Q', answer: 'A' }] }} className="extra-class" />,
        );
        const section = container.querySelector('section');
        expect(section?.className).toContain('extra-class');
    });
});
