# Cloudflare Workers Deployment Guide

This guide details how to deploy the `ottabase-template-app` to Cloudflare Workers with fully automated CI/CD.

## Prerequisites

1.  **Cloudflare Account**: You need a Cloudflare account.
2.  **GitHub Repository**: This code must be hosted on GitHub.
3.  **Wrangler CLI**: Installed locally for setup (`npm install -g wrangler`).

## 1. Local Setup & Resource Creation

We have provided an automated script to create the necessary Cloudflare resources (D1 Database, KV Namespace, R2 Bucket, Queue) and configure your project.

### Quick Start

```bash
# 1. Run the setup script (will prompt for login if needed)
pnpm cloudflare:setup

# 2. Verify everything is configured
pnpm cloudflare:validate
```

### What the Setup Script Does

1. Checks if you're logged in to Cloudflare (shows instructions if not)
2. Creates all required resources in your Cloudflare account:
   - D1 Database: `ottabase-db`
   - KV Namespaces: `OTTABASE_KV` and `OTTABASE_KV_preview`
   - R2 Buckets: `ottabase-bucket` and `ottabase-bucket-preview`
   - Queue: `ottabase-queue`
3. Updates `apps/ottabase-template-app/wrangler.jsonc` with the generated resource IDs

### Important: Resource IDs are Local Only

The setup script updates `wrangler.jsonc` with your personal Cloudflare resource IDs. These IDs are unique to your Cloudflare account and **should not be committed to the repository**.

Each developer running `pnpm cloudflare:setup` will get their own resources with different IDs. The placeholders (`YOUR_D1_DATABASE_ID`, etc.) in the repo serve as a template.

**Options for team workflows:**

- Keep `wrangler.jsonc` in `.gitignore` (each dev runs setup)
- Use environment-specific wrangler configs (e.g., `wrangler.production.jsonc`)
- Store production IDs in CI/CD secrets and inject at deploy time

## 2. GitHub Actions CI/CD Setup

To enable automated deployments on push, you need to configure GitHub Secrets.

1.  Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2.  Click **New repository secret**.
3.  Add the following secrets:

    | Secret Name | Description | How to find it |
    | :--- | :--- | :--- |
    | `CLOUDFLARE_API_TOKEN` | API Token with permissions to deploy Workers, D1, KV, R2. | [Create Token](https://dash.cloudflare.com/profile/api-tokens) -> Use "Edit Cloudflare Workers" template. |
    | `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID. | Found in the Cloudflare Dashboard URL or "Overview" page of any zone/worker. |
    | `D1_DATABASE_ID` | Your D1 database ID for production. | Run `wrangler d1 list` or check the Cloudflare dashboard under Workers & Pages -> D1. |
    | `KV_NAMESPACE_ID` | Your KV namespace ID for production. | Run `wrangler kv:namespace list` or check the Cloudflare dashboard under Workers & Pages -> KV. |

## 3. Deployment Workflow

The CI/CD pipeline is defined in `.github/workflows/deploy.yml`.

- **Trigger**: Pushes to the `main` branch.
- **Process**:
    1.  Checks out the code.
    2.  Installs dependencies (`pnpm`).
    3.  Builds the Next.js application (`pnpm build`).
    4.  Deploys to Cloudflare Workers using `wrangler deploy`.

## Troubleshooting

- **Deployment Fails**: Check the "Actions" tab in GitHub for logs. Common issues include missing secrets or insufficient API token permissions.
- **Database Errors**: Ensure migrations have been applied. You might need to run migrations manually or add a migration step to the pipeline if using D1 migrations.
- **Resource Not Found**: Verify that the IDs in `wrangler.jsonc` match the resources in your Cloudflare dashboard.
