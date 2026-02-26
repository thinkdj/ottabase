import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Disclosure from './Disclosure';

const PRESET_SPONSORED =
    'This content was created in partnership with a sponsor. Our editorial standards remain independent.';

describe('Disclosure Renderer', () => {
    describe('Null rendering', () => {
        it('should return null when no disclosures are active', () => {
            const { container } = render(<Disclosure data={{}} />);
            expect(container.querySelector('.cdc-content-disclosure')).toBeFalsy();
        });

        it('should return null when AI is disabled', () => {
            const { container } = render(<Disclosure data={{ aiEnabled: false, aiLevel: 'slight' }} />);
            expect(container.querySelector('.cdc-content-disclosure')).toBeFalsy();
        });

        it('should return null when sponsored is disabled', () => {
            const { container } = render(<Disclosure data={{ sponsoredEnabled: false, sponsoredType: 'preset' }} />);
            expect(container.querySelector('.cdc-content-disclosure')).toBeFalsy();
        });

        it('should return null when AI level is none', () => {
            const { container } = render(<Disclosure data={{ aiEnabled: true, aiLevel: 'none' }} />);
            expect(container.querySelector('.cdc-content-disclosure')).toBeFalsy();
        });
    });

    describe('AI Disclosure', () => {
        it('should render AI disclosure section for slight level', () => {
            render(<Disclosure data={{ aiEnabled: true, aiLevel: 'slight' }} />);
            expect(screen.getByText('AI Content Notice')).toBeTruthy();
            expect(screen.getByText(/light editing/i)).toBeTruthy();
        });

        it('should render AI disclosure for mid level', () => {
            render(<Disclosure data={{ aiEnabled: true, aiLevel: 'mid' }} />);
            expect(screen.getByText(/significantly used/i)).toBeTruthy();
        });

        it('should render AI disclosure for high level', () => {
            render(<Disclosure data={{ aiEnabled: true, aiLevel: 'high' }} />);
            expect(screen.getByText(/primarily generated/i)).toBeTruthy();
        });

        it('should render custom percentage disclosure', () => {
            render(<Disclosure data={{ aiEnabled: true, aiLevel: 'custom', aiPercent: 80 }} />);
            expect(screen.getByText(/80%/)).toBeTruthy();
            expect(screen.getByText(/AI assistance/i)).toBeTruthy();
        });

        it('should default to 50% for custom level without aiPercent', () => {
            render(<Disclosure data={{ aiEnabled: true, aiLevel: 'custom' }} />);
            expect(screen.getByText(/50%/)).toBeTruthy();
        });

        it('should have correct ARIA role', () => {
            render(<Disclosure data={{ aiEnabled: true, aiLevel: 'slight' }} />);
            expect(screen.getByRole('note', { name: /AI usage disclosure/i })).toBeTruthy();
        });
    });

    describe('Sponsored Disclosure', () => {
        it('should render preset sponsored text', () => {
            render(<Disclosure data={{ sponsoredEnabled: true, sponsoredType: 'preset' }} />);
            expect(screen.getByText('Sponsored Content')).toBeTruthy();
            expect(screen.getByText(PRESET_SPONSORED)).toBeTruthy();
        });

        it('should render custom sponsored text', () => {
            render(
                <Disclosure
                    data={{ sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: 'Paid partnership.' }}
                />,
            );
            expect(screen.getByText('Paid partnership.')).toBeTruthy();
        });

        it('should return null when custom sponsored text is empty', () => {
            const { container } = render(
                <Disclosure data={{ sponsoredEnabled: true, sponsoredType: 'custom', sponsoredText: '' }} />,
            );
            expect(container.querySelector('.cdc-content-disclosure')).toBeFalsy();
        });

        it('should have correct ARIA role', () => {
            render(<Disclosure data={{ sponsoredEnabled: true, sponsoredType: 'preset' }} />);
            expect(screen.getByRole('note', { name: /sponsored content disclosure/i })).toBeTruthy();
        });
    });

    describe('Combined Disclosures', () => {
        it('should render both AI and sponsored disclosures together', () => {
            render(
                <Disclosure
                    data={{
                        aiEnabled: true,
                        aiLevel: 'high',
                        sponsoredEnabled: true,
                        sponsoredType: 'preset',
                    }}
                />,
            );
            expect(screen.getByText('AI Content Notice')).toBeTruthy();
            expect(screen.getByText('Sponsored Content')).toBeTruthy();
            // Combined header label
            expect(screen.getByText('Disclosures')).toBeTruthy();
        });
    });

    describe('Header Label', () => {
        it('should show "AI Disclosure" when only AI is active', () => {
            render(<Disclosure data={{ aiEnabled: true, aiLevel: 'slight' }} />);
            expect(screen.getByText('AI Disclosure')).toBeTruthy();
        });

        it('should show "Sponsored Disclosure" when only sponsored is active', () => {
            render(<Disclosure data={{ sponsoredEnabled: true, sponsoredType: 'preset' }} />);
            expect(screen.getByText('Sponsored Disclosure')).toBeTruthy();
        });

        it('should show "Disclosures" when both are active', () => {
            render(
                <Disclosure
                    data={{
                        aiEnabled: true,
                        aiLevel: 'mid',
                        sponsoredEnabled: true,
                        sponsoredType: 'preset',
                    }}
                />,
            );
            expect(screen.getByText('Disclosures')).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('should render as aside with aria-label', () => {
            const { container } = render(<Disclosure data={{ aiEnabled: true, aiLevel: 'slight' }} />);
            const aside = container.querySelector('aside');
            expect(aside).toBeTruthy();
            expect(aside?.getAttribute('aria-label')).toBe('Content disclosure');
        });

        it('should include not-prose class to avoid prose styling conflicts', () => {
            const { container } = render(<Disclosure data={{ aiEnabled: true, aiLevel: 'slight' }} />);
            const aside = container.querySelector('aside');
            expect(aside?.className).toContain('not-prose');
        });
    });

    describe('Custom ClassName', () => {
        it('should apply custom className', () => {
            const { container } = render(
                <Disclosure data={{ aiEnabled: true, aiLevel: 'slight' }} className="my-custom" />,
            );
            const aside = container.querySelector('aside');
            expect(aside?.className).toContain('my-custom');
        });
    });
});
