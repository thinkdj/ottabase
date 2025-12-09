import NextAuth from "next-auth";
import createAuthConfig from "./auth.config";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth((request) => {
  const env = (request as any)?.env || process.env;

  return {
    ...createAuthConfig(env),
    // override configs below this line, if required;
  };
});

// Previously, this was in pages/api/auth/[...nextauth].ts (next-auth v4)
// Migrated to auth.ts (next-auth v5) 9 Dec '24
// DOCS: https://authjs.dev/getting-started/migrating-to-v5#details
