# @ottabase/backups

Automated D1→R2 database backup service for Cloudflare Workers.

## Features

- **Full SQL Export** — Dumps all D1 tables as SQL INSERT statements to R2
- **Content Hashing** — SHA-256 integrity verification for every backup
- **Retention Policy** — Automatically prunes old backups (configurable limit)
- **Setup Detection** — Reports pending configuration items for admin visibility
- **Admin UI** — Built-in backup management page at `/admin/backups`

## Usage

### Backend (Worker)

```typescript
import { createBackupService } from '@ottabase/backups';

// Create a service instance from Cloudflare bindings
const backupService = createBackupService(env.OBCF_D1, env.OBCF_R2, {
    prefix: 'backups/d1', // R2 key prefix (default)
    maxRetained: 30, // Max backups to keep (default)
    excludeTables: [], // Tables to skip
});

// Create a full backup
const result = await backupService.createBackup({ label: 'daily-auto' });
// { success: true, metadata: { id, sizeBytes, tableCount, totalRows, ... } }

// List all backups
const { backups, stats } = await backupService.listBackups();

// Download backup SQL
const { content } = await backupService.downloadBackup(backupId);

// Delete a backup
await backupService.deleteBackup(backupId);

// Check setup status
const setup = await backupService.checkSetup({ cronConfigured: true });
// { d1Configured, r2Configured, hasBackups, cronConfigured, pendingItems, ready }
```

### Cron Integration

Register a `backup:database` handler in your scheduled tasks:

1. Go to **Admin → Scheduled Tasks**
2. Create a task with handler `backup:database` and your preferred schedule (e.g., `0 2 * * *` for daily at 2 AM UTC)

### Admin UI

The backup management page is available at `/admin/backups` and provides:

- **Setup Status** — Shows D1, R2, cron configuration status with pending action items
- **Backup History** — List of all backups with metadata (size, tables, rows, duration)
- **Create Backup** — Manual one-click backup creation
- **Download** — Download backup SQL files
- **Delete** — Remove individual backups with confirmation

## API Endpoints

| Method   | Endpoint                 | Description          |
| -------- | ------------------------ | -------------------- |
| `GET`    | `/api/admin/backups`     | List backups + setup |
| `POST`   | `/api/admin/backups`     | Create a new backup  |
| `GET`    | `/api/admin/backups/:id` | Download backup SQL  |
| `DELETE` | `/api/admin/backups/:id` | Delete a backup      |

All endpoints require admin access (`system` scope).

## Configuration

```typescript
interface BackupConfig {
    prefix?: string; // R2 key prefix (default: "backups/d1")
    maxRetained?: number; // Max backups to retain (default: 30)
    excludeTables?: string[]; // Tables to exclude from backup
}
```

## Requirements

- Cloudflare D1 database binding (`OBCF_D1`)
- Cloudflare R2 bucket binding (`OBCF_R2`)
- Admin permissions for API access
