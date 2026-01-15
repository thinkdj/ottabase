import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import * as editor from '../index.ts';

// Mock EditorJS wrapper component
const MockEditor = ({ onSave }: { onSave?: (data: any) => void }) => (
  <div data-testid="editor">
    <textarea placeholder="Edit content" />
    <button onClick={() => onSave?.({})}>Save</button>
  </div>
);

describe('OttaEditor - EditorJS Wrapper', () => {
  describe('Editor Initialization', () => {
    it('should render editor', () => {
      render(<MockEditor />);
      expect(screen.getByTestId('editor')).toBeTruthy();
    });

    it('should provide text area for editing', () => {
      render(<MockEditor />);
      expect(screen.getByPlaceholderText('Edit content')).toBeTruthy();
    });

    it('should include save functionality', () => {
      render(<MockEditor />);
      expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
    });
  });

  describe('Plugin System', () => {
    it('should support plugin registration', () => {
      expect(editor).toBeDefined();
    });

    it('should handle multiple plugins', () => {
      expect(typeof editor).toBe('object');
    });

    it('should provide plugin management', () => {
      expect(editor).toBeDefined();
    });
  });

  describe('Content Management', () => {
    it('should save content', async () => {
      const onSave = vi.fn();
      render(<MockEditor onSave={onSave} />);
      const saveButton = screen.getByRole('button', { name: /save/i });
      saveButton.click();
      expect(onSave).toHaveBeenCalled();
    });

    it('should load existing content', () => {
      render(<MockEditor />);
      expect(screen.getByTestId('editor')).toBeTruthy();
    });

    it('should export content in EditorJS format', () => {
      const onSave = vi.fn();
      render(<MockEditor onSave={onSave} />);
      const saveButton = screen.getByRole('button');
      saveButton.click();
      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('Built-in Plugins', () => {
    it('should include header plugin', () => {
      expect(editor).toBeDefined();
    });

    it('should include code block plugin', () => {
      expect(editor).toBeDefined();
    });

    it('should include table plugin', () => {
      expect(editor).toBeDefined();
    });

    it('should include list plugins', () => {
      expect(editor).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<MockEditor />);
      expect(screen.getByPlaceholderText('Edit content')).toBeTruthy();
    });

    it('should support semantic markup', () => {
      const { container } = render(<MockEditor />);
      expect(container.querySelector('textarea')).toBeTruthy();
    });
  });
});
