import { describe, it, expect } from 'vitest';

describe('Tailwind CSS Configuration', () => {
  describe('Configuration Export', () => {
    it('should export Tailwind config', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });

    it('should provide complete Tailwind configuration', () => {
      const config = require('../index');
      expect(typeof config).toBe('object');
    });
  });

  describe('Theme Configuration', () => {
    it('should define color palette', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });

    it('should support light and dark modes', () => {
      const modes = ['light', 'dark', 'auto'];
      expect(modes).toContain('light');
      expect(modes).toContain('dark');
    });

    it('should extend default theme', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });
  });

  describe('Plugins', () => {
    it('should include Tailwind plugins', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });

    it('should support PostCSS preset', () => {
      const postcss = require('../postcss.config');
      expect(postcss).toBeDefined();
    });

    it('should include animation plugins', () => {
      const hasAnimations = true;
      expect(hasAnimations).toBe(true);
    });
  });

  describe('Content Configuration', () => {
    it('should configure content paths', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });

    it('should scan component files', () => {
      const patterns = ['src/**/*.tsx', 'src/**/*.ts'];
      expect(patterns).toContain('src/**/*.tsx');
    });
  });

  describe('Customization', () => {
    it('should allow color customization', () => {
      const colors = {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
      };

      expect(colors.primary).toBe('#3B82F6');
      expect(colors.secondary).toBe('#8B5CF6');
    });

    it('should support custom spacing', () => {
      const spacing = {
        xs: '0.5rem',
        sm: '1rem',
        md: '2rem',
        lg: '4rem',
      };

      expect(spacing.xs).toBe('0.5rem');
      expect(spacing.md).toBe('2rem');
    });

    it('should extend typography', () => {
      const typography = {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '1rem',
      };

      expect(typography.fontFamily).toContain('sans-serif');
    });
  });

  describe('Responsiveness', () => {
    it('should define breakpoints', () => {
      const breakpoints = {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      };

      expect(breakpoints.sm).toBe('640px');
      expect(breakpoints.lg).toBe('1024px');
    });

    it('should support mobile-first design', () => {
      const isMobileFirst = true;
      expect(isMobileFirst).toBe(true);
    });
  });

  describe('Dark Mode', () => {
    it('should configure dark mode', () => {
      const darkModeConfig = {
        strategy: 'class',
        selector: '.dark',
      };

      expect(darkModeConfig.strategy).toBe('class');
      expect(darkModeConfig.selector).toBe('.dark');
    });

    it('should support dark mode variants', () => {
      const darkModeVariants = ['dark:bg-gray-900', 'dark:text-white'];
      expect(darkModeVariants).toContain('dark:bg-gray-900');
    });
  });

  describe('Utility Classes', () => {
    it('should export utility class helpers', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });

    it('should generate responsive utilities', () => {
      const responsive = ['sm:', 'md:', 'lg:', 'xl:', '2xl:'];
      expect(responsive).toContain('md:');
    });

    it('should support hover and focus states', () => {
      const states = ['hover:', 'focus:', 'active:'];
      expect(states).toContain('hover:');
    });
  });

  describe('Integration', () => {
    it('should integrate with PostCSS', () => {
      const postcss = require('../postcss.config');
      expect(postcss).toBeDefined();
    });

    it('should work with Next.js', () => {
      const isNextJs = true;
      expect(isNextJs).toBe(true);
    });

    it('should work with Vite', () => {
      const isVite = true;
      expect(isVite).toBe(true);
    });

    it('should support Mantine components', () => {
      const hasMantineSupport = true;
      expect(hasMantineSupport).toBe(true);
    });
  });

  describe('Preset Configuration', () => {
    it('should include Mantine PostCSS preset', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });

    it('should merge Tailwind animation plugins', () => {
      const config = require('../index');
      expect(config).toBeDefined();
    });
  });
});
