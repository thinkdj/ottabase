# @ottabase/backups

Automated D1→R2 database backup service for Cloudflare Workers.

## Features

- **Full SQL Export** — Dumps all D1 tables as SQL INSERT statements to R2
- **Timestamped Filenames** — Backups saved as `yyyy-mm-dd-hhmmss_appName.sql`
- **Content Hashing** — SHA-256 integrity verification for every backup
- **Day-Based Retention** — Rolling window (e.g., 30 days) automatically deletes old backups
- **Count-Based Retention** — Caps total backup count (e.g., max 30)
- **Setup Detection** — Reports pending configuration items for admin visibility
- **Admin UI** — Built-in backup management page at `/admin/backups` with schedule & retention settings

## Usage

### Backend (Worker)

```typescript
import { createBackupService } from '@ottabase/backups';

// Create a service instance from Cloudflare bindings
const backupService = createBackupService(env.OBCF_D1, env.OBCF_R2, {
    prefix: 'backups/d1', // R2 key prefix (default)
    maxRetained: 30, // Max backups to keep (default)
    retentionDays: 30, // Rolling window in days (default)
    appName: 'my-app', // Used in backup filenames
    excludeTables: [], // Tables to skip
});

// Create a full backup → R2 key: backups/d1/2024-06-15-023000_my-app.sql
const result = await backupService.createBackup({ label: 'daily-auto' });
// { success: true, metadata: { id, sizeBytes, tableCount, totalRows, filename, ... } }

// List all backups
const { backups, stats } = await backupService.listBackups();

// Download backup SQL
const { content, filename } = await backupService.downloadBackup(backupId);

// Delete a backup
await backupService.deleteBackup(backupId);

// Check setup status
const setup = await backupService.checkSetup({ cronConfigured: true });
// { d1Configured, r2Configured, hasBackups, cronConfigured, pendingItems, ready }
```

### Admin UI

The backup management page at `/admin/backups` provides:

- **Setup Status** — Shows D1, R2, cron configuration status with pending action items
- **Settings Panel** — Configure backup schedule (cron) and retention days directly from the UI
- **Backup History** — List of all backups with metadata (filename, size, tables, rows, duration)
- **Create Backup** — Manual one-click backup creation
- **Download** — Download backup SQL files with original filenames
- **Delete** — Remove individual backups with confirmation

### Schedule Configuration

Configure the backup schedule directly from **Admin → Backups → Settings**, or manually:

1. Go to **Admin → Scheduled Tasks**
2. Create a task with handler `backup:database` and your preferred schedule (e.g., `0 2 * * *` for daily at 2 AM UTC)

## API Endpoints

| Method   | Endpoint                      | Description                      |
| -------- | ----------------------------- | -------------------------------- |
| `GET`    | `/api/admin/backups`          | List backups + setup status      |
| `POST`   | `/api/admin/backups`          | Create a new backup              |
| `GET`    | `/api/admin/backups/settings` | Get backup settings              |
| `PUT`    | `/api/admin/backups/settings` | Update schedule & retention days |
| `GET`    | `/api/admin/backups/:id`      | Download backup SQL              |
| `DELETE` | `/api/admin/backups/:id`      | Delete a backup                  |

All endpoints require admin access (`system` scope).

## Configuration

```typescript
interface BackupConfig {
    prefix?: string; // R2 key prefix (default: "backups/d1")
    maxRetained?: number; // Max backups to retain (default: 30)
    retentionDays?: number; // Rolling window in days (default: 30)
    excludeTables?: string[]; // Tables to exclude from backup
    appName?: string; // App name for filenames (default: "ottabase")
}
```

## Requirements

- Cloudflare D1 database binding (`OBCF_D1`)
- Cloudflare R2 bucket binding (`OBCF_R2`)
- Admin permissions for API access
