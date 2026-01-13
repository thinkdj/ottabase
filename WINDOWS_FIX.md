# Windows 11 - Auth Fix Instructions

## Problem
Getting error: "doesn't provide an export named: 'getSession'" on Windows

## Solution: Build Packages on Your Machine

### Step 1: Stop Dev Servers
Close both terminals running `dev:fe` and `dev:be`

### Step 2: Build Auth Package and Dependencies

Open PowerShell or Command Prompt in the project root:

```bash
# Install dependencies (if not already done)
pnpm install

# Build packages in order
pnpm --filter @ottabase/config build
pnpm --filter @ottabase/db build
pnpm --filter @ottabase/ui-shadcn build
pnpm --filter @ottabase/auth build
```

### Step 3: Verify Auth Package Built

Check that this file exists and has content:
```
packages/auth/dist/client-api.mjs
```

You can verify with:
```bash
dir packages\auth\dist
```

Should show files like:
- client-api.mjs
- react-hooks.mjs
- backend-handler.mjs
- etc.

### Step 4: Build Remaining Packages

```bash
pnpm --filter @ottabase/api build
pnpm --filter @ottabase/cf build
pnpm --filter @ottabase/ottaorm build
pnpm --filter @ottabase/ui-components build
pnpm --filter @ottabase/ottaselect build
pnpm --filter @ottabase/forms build
pnpm --filter @ottabase/state build
pnpm --filter @ottabase/ottaeditor build
pnpm --filter @ottabase/ottarenderer build
pnpm --filter @ottabase/cf-realtime build
pnpm --filter @ottabase/utils build
pnpm --filter @ottabase/ui-base build
pnpm --filter @ottabase/ui-code-highlight build
pnpm --filter @ottabase/ui-mantine build
```

**OR** build all packages at once:
```bash
pnpm turbo build --filter='@ottabase/*'
```

### Step 5: Restart Dev Servers

In the tanstack app directory:

**Terminal 1 (Frontend):**
```bash
cd apps/ottabase-template-app-tanstack
pnpm dev:fe
```

**Terminal 2 (Backend):**
```bash
cd apps/ottabase-template-app-tanstack
pnpm dev:be
```

### Step 6: Test

Visit http://127.0.0.1:3003/login

Should now work without the `getSession` error!

## Quick One-Liner (Alternative)

If you want to build everything at once:

```bash
pnpm install && pnpm -r build
```

This will build all packages recursively.

## Troubleshooting

### If you still get the error:

1. **Clear Vite cache:**
   ```bash
   cd apps/ottabase-template-app-tanstack
   rm -rf node_modules/.vite
   ```

2. **Verify the export exists:**
   ```bash
   type packages\auth\dist\client-api.mjs | findstr "getSession"
   ```

   Should show: `export { getSession, ... }`

3. **Hard refresh browser:**
   - Press `Ctrl + F5` or `Ctrl + Shift + R`
   - Or clear browser cache

4. **Check Node version:**
   ```bash
   node --version
   ```
   Should be v18 or higher

### If build fails with "command not found":

Check that dependencies are installed:
```bash
cd packages/auth
dir node_modules\.bin
```

Should show `tsup.cmd` or `tsup.ps1`

If missing, run:
```bash
pnpm install
```

## Windows-Specific Notes

- Use backslashes `\` for paths in Windows commands
- Use PowerShell or Git Bash (recommended)
- If using Command Prompt, commands are the same but path syntax differs
- Make sure to run as Administrator if permission issues occur

## Verification Checklist

After building:
- [ ] `packages/auth/dist/client-api.mjs` exists
- [ ] File contains `export { getSession, ...`
- [ ] Dev servers start without errors
- [ ] Login page loads at http://127.0.0.1:3003/login
- [ ] No "doesn't provide an export" errors

## Need More Help?

If still having issues, check:
1. Node.js version (should be 18+)
2. pnpm version (run `pnpm --version`)
3. Any TypeScript errors during build
4. Terminal output for specific error messages

Share the full error output if the problem persists.
