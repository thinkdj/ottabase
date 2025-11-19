/**
 * Shared handler registry for scheduler tasks
 * Define all custom task handlers here to avoid duplication across API routes
 */

export type TaskHandler = (payload?: unknown) => Promise<unknown>;

export const schedulerHandlers: Record<string, TaskHandler> = {
  'send-summary-email': async (payload?: unknown) => {
    const params = payload as {
      recipients?: string[];
      subject?: string;
      template?: string;
    };

    console.log('[Scheduler] Sending summary email:', {
      recipients: params?.recipients,
      subject: params?.subject || 'Daily Summary',
      template: params?.template || 'default',
    });

    // In production, integrate with actual email service (Resend, SendGrid, etc.)
    // await emailService.send({ to: params.recipients, ... });

    return {
      success: true,
      sent: params?.recipients?.length || 1,
      subject: params?.subject || 'Daily Summary',
      timestamp: new Date().toISOString(),
    };
  },

  'demo-task': async (payload?: unknown) => {
    const params = payload as { message?: string };
    console.log('[Scheduler] Demo task executed:', params?.message || 'No message');

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      message: params?.message || 'Demo task completed',
      timestamp: new Date().toISOString(),
    };
  },

  'cleanup-task': async (payload?: unknown) => {
    const params = payload as { daysToKeep?: number };
    const daysToKeep = params?.daysToKeep || 30;

    console.log(`[Scheduler] Running cleanup (keeping last ${daysToKeep} days)`);

    // In production, perform actual cleanup operations
    // await cleanupOldLogs(daysToKeep);
    // await cleanupTempFiles();

    return {
      success: true,
      cleaned: Math.floor(Math.random() * 100), // Mock value
      daysToKeep,
      timestamp: new Date().toISOString(),
    };
  },

  'database-backup': async (payload?: unknown) => {
    const params = payload as { target?: string };

    console.log('[Scheduler] Running database backup to:', params?.target || 'default-backup');

    // In production, trigger actual backup service
    // await backupService.backup({ destination: params.target });

    return {
      success: true,
      target: params?.target || 'default-backup',
      size: '1.2MB', // Mock value
      timestamp: new Date().toISOString(),
    };
  },
};
