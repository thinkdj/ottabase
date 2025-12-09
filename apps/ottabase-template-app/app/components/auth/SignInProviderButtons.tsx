"use client";

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AuthProvider, ProviderType } from '@/app/lib/auth-providers';

interface SignInProviderButtonsProps {
  providers: Record<string, AuthProvider>;
  onProviderClick: (provider: ProviderType, email?: string) => void;
  isLoading?: boolean;
}

// Email validation utility
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

// Email magic link form component
function EmailMagicLinkForm({
  onSubmit,
  onCancel,
  isLoading
}: {
  onSubmit: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    onSubmit(trimmedEmail);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError('');
          }}
          placeholder="Enter your email address"
          className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm/6"
        />
        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send Magic Link'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SignInProviderButtons({
  providers,
  onProviderClick,
  isLoading = false
}: SignInProviderButtonsProps) {
  const [showEmailInput, setShowEmailInput] = useState(false);

  const enabledProviders = Object.values(providers)
    .filter(provider => provider.enabled && provider.id !== 'credentials');

  const credentialsEnabled = providers.credentials?.enabled || false;
  const allAuthDisabled = enabledProviders.length === 0 && !credentialsEnabled;

  const handleProviderClick = (providerId: ProviderType) => {
    if (providerId === 'email') {
      setShowEmailInput(true);
    } else {
      onProviderClick(providerId);
    }
  };

  const handleEmailSubmit = (email: string) => {
    onProviderClick('email', email);
    setShowEmailInput(false);
  };

  const handleEmailCancel = () => {
    setShowEmailInput(false);
  };

  if (allAuthDisabled) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <span>Authentication is currently disabled</span>
      </div>
    );
  }

  if (enabledProviders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {enabledProviders.map((provider) => (
        <div key={provider.id}>
          <button
            onClick={() => handleProviderClick(provider.id as ProviderType)}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {provider.iconTabler}
            {provider.buttonText}
          </button>

          {/* Email input form for email provider */}
          {provider.id === 'email' && showEmailInput && (
            <EmailMagicLinkForm
              onSubmit={handleEmailSubmit}
              onCancel={handleEmailCancel}
              isLoading={isLoading}
            />
          )}
        </div>
      ))}
    </div>
  );
}
