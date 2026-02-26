import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Map from './Map';

describe('Map Renderer', () => {
    describe('Valid URLs', () => {
        it('should render OpenStreetMap embed for valid OSM URL', () => {
            render(
                <Map
                    data={{
                        url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                        provider: 'openstreetmap',
                    }}
                />,
            );
            const iframe = screen.getByTitle(/OpenStreetMap map/i);
            expect(iframe).toBeTruthy();
            expect(iframe.getAttribute('src')).toContain('openstreetmap.org/export/embed.html');
        });

        it('should render Google Maps embed for valid Google URL', () => {
            render(
                <Map
                    data={{
                        url: 'https://www.google.com/maps/place/London',
                        provider: 'gmaps',
                    }}
                />,
            );
            const iframe = screen.getByTitle(/Google Maps map/i);
            expect(iframe).toBeTruthy();
            expect(iframe.getAttribute('src')).toContain('maps.google.com');
        });

        it('should render caption when provided', () => {
            render(
                <Map
                    data={{
                        url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                        caption: 'London city center',
                    }}
                />,
            );
            expect(screen.getByText('London city center')).toBeTruthy();
        });
    });

    describe('Invalid / unsupported URLs', () => {
        it('should show fallback when embed URL cannot be generated', () => {
            render(
                <Map
                    data={{
                        url: 'https://example.com/not-a-map',
                        provider: 'openstreetmap',
                    }}
                />,
            );
            expect(screen.getByText('Map preview unavailable')).toBeTruthy();
            const link = screen.getByRole('link', { name: /open map/i });
            expect(link.getAttribute('href')).toBe('https://example.com/not-a-map');
        });

        it('should still show caption in fallback state', () => {
            render(
                <Map
                    data={{
                        url: 'https://evil.com/fake',
                        caption: 'Broken map link',
                    }}
                />,
            );
            expect(screen.getByText('Broken map link')).toBeTruthy();
        });
    });

    describe('Height clamping', () => {
        it('should clamp height to max 800px', () => {
            render(
                <Map
                    data={{
                        url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                        height: 2000,
                    }}
                />,
            );
            const iframe = screen.getByTitle(/OpenStreetMap map/i);
            expect(iframe.getAttribute('height')).toBe('800');
        });

        it('should clamp height to min 100px', () => {
            render(
                <Map
                    data={{
                        url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                        height: 50,
                    }}
                />,
            );
            const iframe = screen.getByTitle(/OpenStreetMap map/i);
            expect(iframe.getAttribute('height')).toBe('100');
        });

        it('should use default height 400 when not provided', () => {
            render(
                <Map
                    data={{
                        url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                    }}
                />,
            );
            const iframe = screen.getByTitle(/OpenStreetMap map/i);
            expect(iframe.getAttribute('height')).toBe('400');
        });
    });

    describe('Edge cases', () => {
        it('should return null when url is empty', () => {
            const { container } = render(<Map data={{ provider: 'openstreetmap' }} />);
            expect(container.querySelector('.cdc-content-map')).toBeFalsy();
        });

        it('should have schema.org markup', () => {
            const { container } = render(
                <Map
                    data={{
                        url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                    }}
                />,
            );
            const figure = container.querySelector('[itemscope][itemtype="https://schema.org/Map"]');
            expect(figure).toBeTruthy();
        });

        it('should apply dark inversion for Google Maps with dark theme', () => {
            const { container } = render(
                <Map
                    data={{
                        url: 'https://www.google.com/maps/place/London',
                        provider: 'gmaps',
                        theme: 'dark',
                    }}
                />,
            );
            const wrapper = container.querySelector('[style*="invert"]');
            expect(wrapper).toBeTruthy();
        });
    });
});
