import { signIn } from "next-auth/react";
import type { ProviderType } from "./auth-providers";

/**
 * Shared utility for handling authentication provider sign-in
 * Handles both social providers and email magic link provider
 */
export async function handleProviderSignIn(
  provider: ProviderType,
  email?: string,
  callbackUrl: string = '/'
) {
  if (provider === 'email' && email) {
    return await signIn('email', { email, callbackUrl });
  } else {
    return await signIn(provider, { callbackUrl });
  }
}
