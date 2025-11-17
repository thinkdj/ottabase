'use client';

import React, { useState } from 'react';
import { OttaSearch, createMockAdapter } from '@ottabase/ottasearch';
import type { SearchResult } from '@ottabase/ottasearch';

export default function OttaSearchDemo() {
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Create mock adapter for demo
  const mockAdapter = createMockAdapter();

  const handleSelect = (result: SearchResult) => {
    setSelectedResult(result);
    console.log('Selected:', result);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            OttaSearch Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Universal search with flexible triggers and display modes
          </p>
        </div>

        {/* Popover Variants - NEW! */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Popover Display (Dropdown)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Minimal dropdown that appears below the trigger. Perfect for quick searches.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Icon + Popover */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Icon Trigger
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Just an icon. Click to expand and search.
                </p>
              </div>
              <div className="flex justify-center">
                <OttaSearch
                  adapter={mockAdapter}
                  trigger="icon-input"
                  display="popover"
                  onSelect={handleSelect}
                />
              </div>
            </div>

            {/* Input + Popover */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Input Trigger
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Search input with dropdown results below.
                </p>
              </div>
              <OttaSearch
                adapter={mockAdapter}
                trigger="input"
                display="popover"
                placeholder="Search anything..."
                onSelect={handleSelect}
              />
            </div>

            {/* Icon Input + Popover */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Icon + Input
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Icon that expands to input with popover.
                </p>
              </div>
              <div className="flex justify-center">
                <OttaSearch
                  adapter={mockAdapter}
                  trigger="icon-input"
                  display="popover"
                  size="lg"
                  onSelect={handleSelect}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Variants */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Modal Display (Full-Screen)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Notion-like full-screen search experience. Press{' '}
              <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                ⌘K
              </kbd>{' '}
              for button trigger.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Button + Modal */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Button Trigger
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Button that opens full-screen modal.
                </p>
              </div>
              <OttaSearch
                adapter={mockAdapter}
                trigger="button"
                display="modal"
                onSelect={handleSelect}
              />
            </div>

            {/* Input + Modal */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Input Trigger
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Input field that opens modal on click.
                </p>
              </div>
              <OttaSearch
                adapter={mockAdapter}
                trigger="input"
                display="modal"
                placeholder="Click to search..."
                onSelect={handleSelect}
              />
            </div>
          </div>
        </div>

        {/* Selected Result Display */}
        {selectedResult && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Selected Result
              </h3>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-blue-900 dark:text-blue-100">Title:</span>{' '}
                <span className="text-blue-700 dark:text-blue-300">{selectedResult.title}</span>
              </div>
              {selectedResult.description && (
                <div>
                  <span className="font-medium text-blue-900 dark:text-blue-100">Description:</span>{' '}
                  <span className="text-blue-700 dark:text-blue-300">{selectedResult.description}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-blue-900 dark:text-blue-100">Category:</span>{' '}
                <span className="text-blue-700 dark:text-blue-300">{selectedResult.category}</span>
              </div>
              {selectedResult.url && (
                <div>
                  <span className="font-medium text-blue-900 dark:text-blue-100">URL:</span>{' '}
                  <span className="text-blue-700 dark:text-blue-300">{selectedResult.url}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Features
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Flexible triggers: button, input, icon, icon-input</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Display modes: modal (full-screen), popover (dropdown)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Keyboard navigation (↑/↓/Enter/Esc)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Global shortcut (⌘K / Ctrl+K for modal)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Dark mode support</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Notion-inspired minimal UI</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>D1 database integration</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>TypeScript support</span>
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Usage Examples
          </h3>

          {/* Popover Examples */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Popover (Dropdown)
            </h4>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs">
              <code className="text-gray-800 dark:text-gray-200">{`// Icon that expands to input with dropdown
<OttaSearch
  adapter={adapter}
  trigger="icon-input"
  display="popover"
/>

// Input with dropdown
<OttaSearch
  adapter={adapter}
  trigger="input"
  display="popover"
  placeholder="Quick search..."
/>`}</code>
            </pre>
          </div>

          {/* Modal Examples */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Modal (Full-Screen)
            </h4>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs">
              <code className="text-gray-800 dark:text-gray-200">{`// Button with modal (⌘K shortcut)
<OttaSearch
  adapter={adapter}
  trigger="button"
  display="modal"
/>

// Input field that opens modal
<OttaSearch
  adapter={adapter}
  trigger="input"
  display="modal"
  placeholder="Click to search..."
/>`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
