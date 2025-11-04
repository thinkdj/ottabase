export default function QueuesDemoPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Queues Demo
          </h1>
          <p className="text-gray-600">
            Async message queue processing
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 text-sm font-medium text-blue-900">Coming Soon</h3>
          <p className="mb-4 text-sm text-blue-700">
            This demo will showcase:
          </p>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• Send messages to queue</li>
            <li>• Batch message sending</li>
            <li>• Process messages with consumer</li>
            <li>• Retry failed messages</li>
            <li>• Dead letter queue handling</li>
          </ul>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Quick Start
          </h3>
          <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { createQueuesClient } from '@ottabase/cf/queues';

const queue = createQueuesClient({ queue: env.MY_QUEUE });

// Send message
await queue.send({
  userId: 123,
  action: 'send-email'
});

// Send batch
await queue.sendBatch([
  { body: { userId: 1, action: 'task-1' } },
  { body: { userId: 2, action: 'task-2' } }
]);`}
          </pre>
        </div>
      </div>
    </div>
  );
}
