'use client';

import React, { useState } from 'react';
import { OttaSearch, SearchButton, SearchInput, createMockAdapter } from '@ottabase/ottasearch';
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
            Universal search component with Notion-like UI and keyboard navigation
          </p>
        </div>

        {/* Variant Demos */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Modal Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Modal Variant
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Full-screen Notion-like search experience. Press{' '}
                <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                  ⌘K
                </kbd>{' '}
                or click the button.
              </p>
            </div>
            <OttaSearch
              adapter={mockAdapter}
              variant="modal"
              onSelect={handleSelect}
            />
          </div>

          {/* Button Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Button Variant
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Simple button that opens search modal. Perfect for navigation bars.
              </p>
            </div>
            <OttaSearch
              adapter={mockAdapter}
              variant="button"
              onSelect={handleSelect}
              className="w-full md:w-auto"
            />
          </div>

          {/* Input Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4 md:col-span-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Input Variant
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Inline search with dropdown results. Use arrow keys to navigate.
              </p>
            </div>
            <OttaSearch
              adapter={mockAdapter}
              variant="input"
              placeholder="Try searching for users, documents, or tasks..."
              onSelect={handleSelect}
            />
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
              <span>Keyboard navigation (↑/↓/Enter/Esc)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Global shortcut (⌘K / Ctrl+K)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Dark mode support</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Grouped results by category</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Recent searches tracking</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>D1 database integration</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Mock mode for demos</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>TypeScript support</span>
            </div>
          </div>
        </div>

        {/* Usage Example */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Usage Example
          </h3>
          <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="text-gray-800 dark:text-gray-200">{`import { OttaSearch, createMockAdapter } from '@ottabase/ottasearch';

const mockAdapter = createMockAdapter();

function App() {
  return (
    <OttaSearch
      adapter={mockAdapter}
      variant="modal"
      onSelect={(result) => console.log(result)}
    />
  );
}`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
