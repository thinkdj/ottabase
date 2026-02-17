import { Link } from '@tanstack/react-router';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { CodeBlock } from '@ottabase/ui-code-highlight';

export function CodeBlockDemoPage() {
    // Example code snippets
    const examples = [
        {
            title: 'Basic JavaScript',
            description: 'Simple code block with JavaScript syntax highlighting',
            code: `const greeting = "Hello, World!";
console.log(greeting);

function add(a, b) {
    return a + b;
}

const result = add(5, 3);`,
            language: 'javascript' as const,
            usage: `<CodeBlock
  code={\`const greeting = "Hello, World!";
console.log(greeting);

function add(a, b) {
    return a + b;
}\`}
  language="javascript"
/>`,
        },
        {
            title: 'TypeScript with Filename',
            description: 'TypeScript code with a filename header',
            code: `interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
}

const createUser = async (data: Omit<User, 'id'>): Promise<User> => {
    const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.json();
};`,
            language: 'typescript' as const,
            filename: 'user.service.ts',
            usage: `<CodeBlock
  code={\`interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
}\`}
  language="typescript"
  filename="user.service.ts"
/>`,
        },
        {
            title: 'React Component with Line Numbers',
            description: 'React/TSX code with line numbers enabled',
            code: `import { useState } from 'react';
import { Button } from '@ottabase/ui-shadcn';

export function Counter() {
    const [count, setCount] = useState(0);

    return (
        <div className="flex items-center gap-4">
            <Button onClick={() => setCount(count - 1)}>
                -
            </Button>
            <span className="text-2xl font-bold">{count}</span>
            <Button onClick={() => setCount(count + 1)}>
                +
            </Button>
        </div>
    );
}`,
            language: 'tsx' as const,
            filename: 'Counter.tsx',
            showLineNumbers: true,
            usage: `<CodeBlock
  code={\`import { useState } from 'react';

export function Counter() {
    const [count, setCount] = useState(0);
    // ...
}\`}
  language="tsx"
  filename="Counter.tsx"
  showLineNumbers={true}
/>`,
        },
        {
            title: 'JSON Data',
            description: 'JSON with automatic formatting',
            code: `{
  "name": "ottabase",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.3.1",
    "@tanstack/react-router": "^1.101.1",
    "@ottabase/ui-code-highlight": "^0.1.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}`,
            language: 'json' as const,
            filename: 'package.json',
            usage: `<CodeBlock
  code={\`{
  "name": "ottabase",
  "version": "1.0.0"
}\`}
  language="json"
  filename="package.json"
/>`,
        },
        {
            title: 'CSS Styling',
            description: 'CSS with proper syntax highlighting',
            code: `.card {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease-in-out;
}

@media (max-width: 768px) {
    .card {
        padding: 1rem;
    }
}`,
            language: 'css' as const,
            filename: 'styles.css',
            usage: `<CodeBlock
  code={\`.card {
    background: var(--background);
    padding: 1.5rem;
}\`}
  language="css"
  filename="styles.css"
/>`,
        },
        {
            title: 'Bash/Shell Script',
            description: 'Shell commands with proper highlighting',
            code: `#!/bin/bash

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Deploy to production
if [ "$NODE_ENV" = "production" ]; then
    echo "Deploying to production..."
    pnpm deploy
else
    echo "Running in development mode"
    pnpm dev
fi`,
            language: 'bash' as const,
            filename: 'deploy.sh',
            showLineNumbers: true,
            usage: `<CodeBlock
  code={\`#!/bin/bash

pnpm install
pnpm build
pnpm deploy\`}
  language="bash"
  filename="deploy.sh"
  showLineNumbers={true}
/>`,
        },
        {
            title: 'SQL Query',
            description: 'SQL with syntax highlighting',
            code: `SELECT
    u.id,
    u.name,
    u.email,
    COUNT(o.id) as order_count,
    SUM(o.total) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2024-01-01'
    AND u.status = 'active'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 0
ORDER BY total_spent DESC
LIMIT 10;`,
            language: 'sql' as const,
            usage: `<CodeBlock
  code={\`SELECT u.id, u.name
FROM users u
WHERE u.status = 'active'\`}
  language="sql"
/>`,
        },
        {
            title: 'Python Script',
            description: 'Python with proper indentation highlighting',
            code: `def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n terms."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]

    sequence = [0, 1]
    while len(sequence) < n:
        next_num = sequence[-1] + sequence[-2]
        sequence.append(next_num)

    return sequence

# Generate first 10 Fibonacci numbers
result = fibonacci(10)
print(f"Fibonacci sequence: {result}")`,
            language: 'python' as const,
            filename: 'fibonacci.py',
            showLineNumbers: true,
            usage: `<CodeBlock
  code={\`def fibonacci(n: int) -> list[int]:
    if n <= 0:
        return []
    # ...\`}
  language="python"
  filename="fibonacci.py"
  showLineNumbers={true}
/>`,
        },
    ];

    const renderExample = (example: (typeof examples)[0], index: number) => (
        <Card key={index}>
            <CardHeader>
                <CardTitle className="text-lg">{example.title}</CardTitle>
                <CardDescription>{example.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Example Preview */}
                <div>
                    <CodeBlock
                        code={example.code}
                        language={example.language}
                        filename={example.filename}
                        showLineNumbers={example.showLineNumbers}
                    />
                </div>

                {/* Code to create this example */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Usage:</p>
                    </div>
                    <CodeBlock code={example.usage} language="tsx" />
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">CodeBlock Component</h1>
                <p className="text-muted-foreground">
                    @ottabase/ui-code-highlight - Syntax highlighting with highlight.js
                </p>
            </div>

            {/* Features Overview */}
            <Card>
                <CardHeader>
                    <CardTitle>Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className="font-semibold">✨ Highlights</h3>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• GitHub-style syntax highlighting</li>
                                <li>• Light/dark mode support</li>
                                <li>• Copy to clipboard button</li>
                                <li>• Optional filename header</li>
                                <li>• Optional line numbers</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold">📦 Technical Details</h3>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Powered by highlight.js (76KB core)</li>
                                <li>• 190+ languages supported</li>
                                <li>• Zero runtime dependencies</li>
                                <li>• No provider wrapper needed</li>
                                <li>• Automatic theme detection</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Supported Languages */}
            <Card>
                <CardHeader>
                    <CardTitle>Supported Languages</CardTitle>
                    <CardDescription>Common languages included in the bundle</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {[
                            'javascript',
                            'typescript',
                            'tsx',
                            'jsx',
                            'html',
                            'css',
                            'scss',
                            'json',
                            'bash',
                            'shell',
                            'sql',
                            'python',
                            'markdown',
                            'plaintext',
                        ].map((lang) => (
                            <span
                                key={lang}
                                className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium"
                            >
                                {lang}
                            </span>
                        ))}
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Need more languages? Import and register them from{' '}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">highlight.js/lib/languages/</code>
                    </p>
                </CardContent>
            </Card>

            {/* Installation */}
            <Card>
                <CardHeader>
                    <CardTitle>Installation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <CodeBlock code="pnpm add @ottabase/ui-code-highlight" language="bash" />
                    <CodeBlock
                        code={`import { CodeBlock } from '@ottabase/ui-code-highlight';

function MyComponent() {
    return (
        <CodeBlock
            code="const hello = 'world';"
            language="javascript"
        />
    );
}`}
                        language="tsx"
                    />
                </CardContent>
            </Card>

            {/* Examples */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold mb-2">Examples</h2>
                    <p className="text-sm text-muted-foreground">
                        Each example shows the rendered component and the code to create it
                    </p>
                </div>

                <div className="space-y-6">{examples.map((example, index) => renderExample(example, index))}</div>
            </div>

            {/* Props API */}
            <Card>
                <CardHeader>
                    <CardTitle>Props API</CardTitle>
                    <CardDescription>Available props for the CodeBlock component</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2 font-semibold">Prop</th>
                                    <th className="text-left p-2 font-semibold">Type</th>
                                    <th className="text-left p-2 font-semibold">Default</th>
                                    <th className="text-left p-2 font-semibold">Description</th>
                                </tr>
                            </thead>
                            <tbody className="text-muted-foreground">
                                <tr className="border-b">
                                    <td className="p-2 font-mono">code</td>
                                    <td className="p-2">string</td>
                                    <td className="p-2">-</td>
                                    <td className="p-2">The code to highlight (required)</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="p-2 font-mono">language</td>
                                    <td className="p-2">string</td>
                                    <td className="p-2">-</td>
                                    <td className="p-2">Language for syntax highlighting (required)</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="p-2 font-mono">filename</td>
                                    <td className="p-2">string</td>
                                    <td className="p-2">undefined</td>
                                    <td className="p-2">Optional filename to display in header</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="p-2 font-mono">showLineNumbers</td>
                                    <td className="p-2">boolean</td>
                                    <td className="p-2">false</td>
                                    <td className="p-2">Show line numbers on the left</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
