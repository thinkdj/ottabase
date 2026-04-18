// ============================================================
// Auth Implementation - App-Specific Overrides
// ============================================================
//
// This file contains app-specific authentication configuration.
// Most auth logic is in @ottabase/auth package.
//
// To customize:
// 1. Override the authorize function for custom user validation
// 2. Add custom JWT/session callbacks
// 3. Configure session duration
//
// ============================================================

export { handleAuthRequest, type AuthEnv, type CreateAuthConfigOptions } from '@ottabase/auth/backend';

// Example: Custom authorization logic (uncomment to use)
/*
import { hashPassword, verifyPassword } from "@ottabase/auth/backend";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { User } from "../ottabase/models/User";

export async function customAuthorize(credentials: { email: string; password: string }) {
    const { email, password } = credentials;
    
    // Query your database
    const db = drizzle(env.OBCF_D1);
    const user = await db.select().from(User).where(eq(User.email, email)).get();
    
    if (!user) {
        return null; // User not found
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
        return null; // Invalid password
    }
    
    // Return user object (without sensitive data like password hash)
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        // Add any custom fields
        role: user.role,
    };
}
*/
