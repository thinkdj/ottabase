"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthLayout from '@/app/components/auth/AuthLayout';
import SignInProviderButtons from '@/app/components/auth/SignInProviderButtons';
import { getAuthProviders, type ProviderType } from '@/app/lib/auth-providers';
import { handleProviderSignIn } from '@/app/lib/auth-helpers';

export default function SignInClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const providers = getAuthProviders();

  // Check for error in URL params
  useEffect(() => {
    const urlError = searchParams?.get('error');
    if (urlError) {
      const errorMessages: Record<string, string> = {
        'CredentialsSignin': 'Invalid credentials. Please check and try again.',
        'OAuthAccountNotLinked': 'This email is already associated with another account. Please sign in with the original method.',
        'AccessDenied': 'Access denied. You do not have permission to access this resource.',
        'Default': 'An authentication error occurred. Please try again.',
      };
      setError(errorMessages[urlError] || errorMessages['Default']);
    }
  }, [searchParams]);

  const handleSignIn = async (provider: ProviderType, email?: string) => {
    setIsLoading(true);
    setError('');
    try {
      await handleProviderSignIn(provider, email, '/demo/auth');
    } catch (error) {
      console.error('Sign-in error:', error);
      setError('An error occurred during sign-in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const subtitle = (
    <>
      Testing authentication in the demo environment.{' '}
      <a
        href="/demo/auth"
        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
      >
        Back to demo
      </a>
    </>
  );

  return (
    <AuthLayout title="Sign in" subtitle={subtitle}>
      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Provider Buttons */}
      <SignInProviderButtons
        providers={providers}
        onProviderClick={handleSignIn}
        isLoading={isLoading}
      />

      {/* Info Text */}
      <div className="mt-6 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> This is a demo authentication page. Configure OAuth providers
          via environment variables (GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, etc.) to enable sign-in.
        </p>
      </div>
    </AuthLayout>
  );
}
