"use client";

import React, { useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { User, LogOut, LogIn, Shield, Clock, Mail } from 'lucide-react';
import Link from 'next/link';
import SignInProviderButtons from '@/app/components/auth/SignInProviderButtons';
import { getAuthProviders, type ProviderType } from '@/app/lib/auth-providers';
import { handleProviderSignIn } from '@/app/lib/auth-helpers';

interface AuthDemoClientProps {
  session: Session | null;
}

export default function AuthDemoClient({ session }: AuthDemoClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const providers = getAuthProviders();

  const handleSignIn = async (provider: ProviderType, email?: string) => {
    setIsLoading(true);
    try {
      await handleProviderSignIn(provider, email, '/demo/auth');
    } catch (error) {
      console.error('Sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut({ callbackUrl: '/demo/auth' });
    } catch (error) {
      console.error('Sign-out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
          <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Authentication Demo
        </h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Auth.js + Cloudflare D1 + @ottabase/auth
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Authentication Status */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
            <User className="h-5 w-5" />
            Authentication Status
          </h2>

          {session ? (
            <div className="space-y-4">
              {/* User Info */}
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-800">
                      <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                      Authenticated
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-green-800 dark:text-green-200">
                      {session.user?.name && (
                        <p><strong>Name:</strong> {session.user.name}</p>
                      )}
                      {session.user?.email && (
                        <p className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <strong>Email:</strong> {session.user.email}
                        </p>
                      )}
                      {session.user?.image && (
                        <div className="mt-2">
                          <img
                            src={session.user.image}
                            alt="User avatar"
                            className="h-12 w-12 rounded-full border-2 border-green-200 dark:border-green-700"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Details */}
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Session Details
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {session.expires && (
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <strong>Expires:</strong> {new Date(session.expires).toLocaleString()}
                    </p>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                      View raw session data
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-gray-100 dark:bg-gray-900 p-2 text-xs">
                      {JSON.stringify(session, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-red-600 dark:bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 dark:hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not Authenticated Message */}
              <div className="rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Not Authenticated
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Sign in to access your account
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Sign In */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                  Quick Sign In
                </h3>
                <SignInProviderButtons
                  providers={providers}
                  onProviderClick={handleSignIn}
                  isLoading={isLoading}
                />
              </div>

              {/* Or link to full sign-in page */}
              <div className="text-center">
                <Link
                  href="/demo/auth/signin"
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  Go to full sign-in page
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Documentation/Info */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            About This Demo
          </h2>

          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Features
              </h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Auth.js v5 integration</li>
                <li>Cloudflare D1 database adapter</li>
                <li>Multiple OAuth providers (Google, GitHub, Discord, etc.)</li>
                <li>Email magic link support</li>
                <li>Drizzle ORM for D1 queries</li>
                <li>Edge runtime compatible</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Architecture
              </h3>
              <ul className="list-disc list-inside space-y-1">
                <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">@ottabase/auth</code> - Framework-agnostic auth package</li>
                <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">app/auth.config.ts</code> - Auth configuration</li>
                <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">app/auth.ts</code> - Next.js wrapper</li>
                <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">app/components/auth</code> - Reusable UI components</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Configuration
              </h3>
              <p className="mb-2">
                Providers are auto-configured based on environment variables:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code></li>
                <li><code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">GITHUB_CLIENT_ID</code></li>
                <li><code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">DISCORD_CLIENT_ID</code></li>
                <li><code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">EMAIL_SERVER</code></li>
              </ul>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/demo"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
              >
                ← Back to all demos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
