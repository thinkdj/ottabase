/* eslint-disable react/no-inline-styles */
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { useState } from 'react';
import { getDomainName, getSegment, isValidUrl, joinPaths, makeSlug, replaceDoubleSlashes } from './url';

// Simple function demo component
const FunctionDemo = ({
    title,
    fn,
    examples,
}: {
    title: string;
    fn: (...args: any[]) => any;
    examples: Array<{ input: any[]; description: string; expected?: any }>;
}) => {
    return (
        <div className="p-6 max-w-4xl">
            <h3 className="text-xl font-bold text-blue-600 mb-4">{title}</h3>
            <div className="space-y-4">
                {examples.map((example, index) => {
                    let result;
                    let error = null;
                    try {
                        result = fn(...example.input);
                    } catch (err) {
                        error = (err as Error).message;
                    }

                    const passed =
                        example.expected === undefined ||
                        (error === null && JSON.stringify(result) === JSON.stringify(example.expected));

                    return (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <strong>Input:</strong>
                                    <div className="font-mono text-xs bg-gray-200 p-1 rounded mt-1">
                                        {example.input.map((arg, i) => (
                                            <div key={i}>{JSON.stringify(arg)}</div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <strong>Result:</strong>
                                    <div
                                        className={`font-mono text-xs p-1 rounded mt-1 ${
                                            error ? 'bg-red-100 text-red-700' : 'bg-green-100'
                                        }`}
                                    >
                                        {error || JSON.stringify(result)}
                                    </div>
                                </div>

                                <div>
                                    <strong>Expected:</strong>
                                    <div className="font-mono text-xs bg-blue-100 p-1 rounded mt-1">
                                        {JSON.stringify(example.expected)}
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <span className="text-2xl">{passed ? '✅' : '❌'}</span>
                                    <div className="ml-2 text-xs">{example.description}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Interactive tester component
const InteractiveTester = () => {
    const [input, setInput] = useState('');
    const [separator, setSeparator] = useState('-');

    return (
        <div className="p-6 max-w-2xl">
            <h3 className="text-xl font-bold mb-4">🧪 Interactive URL Function Tester</h3>

            <div className="space-y-4 mb-6">
                <div>
                    <label className="block font-semibold mb-2">Input Text:</label>
                    <input
                        type="text"
                        value={input}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                        placeholder="Enter text to test..."
                        className="w-full p-2 border rounded-md"
                    />
                </div>

                <div>
                    <label className="block font-semibold mb-2">Separator (for makeSlug):</label>
                    <input
                        type="text"
                        value={separator}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeparator(e.target.value)}
                        placeholder="-"
                        className="w-full p-2 border rounded-md"
                    />
                </div>
            </div>

            {input && (
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3">Results:</h4>
                    <div className="space-y-2 text-sm font-mono">
                        <div>
                            <strong>makeSlug:</strong> "{makeSlug(input, separator || '-')}"
                        </div>
                        <div>
                            <strong>isValidUrl:</strong> {JSON.stringify(isValidUrl(input))}
                        </div>
                        <div>
                            <strong>getDomainName:</strong> {JSON.stringify(getDomainName(input))}
                        </div>
                        <div>
                            <strong>replaceDoubleSlashes:</strong> "{replaceDoubleSlashes(input)}"
                        </div>
                        <div>
                            <strong>getSegment (/, 1):</strong> {JSON.stringify(getSegment(input, '/', 1))}
                        </div>
                        <div>
                            <strong>getSegment (/, 2):</strong> {JSON.stringify(getSegment(input, '/', 2))}
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold mb-2">💡 Try these examples:</h4>
                <ul className="text-sm space-y-1">
                    <li>
                        <code>Hello World! 123</code>
                    </li>
                    <li>
                        <code>https://www.example.com/path/to/resource</code>
                    </li>
                    <li>
                        <code>José & María: Story!</code>
                    </li>
                    <li>
                        <code>path/to/resource</code>
                    </li>
                </ul>
            </div>
        </div>
    );
};

// Test data
const makeSlugExamples = [
    {
        input: ['Hello World!'],
        expected: 'hello-world',
        description: 'Basic conversion',
    },
    {
        input: ['Hello World!', '_'],
        expected: 'hello_world',
        description: 'Custom separator',
    },
    {
        input: ['José & María'],
        expected: 'jose-maria',
        description: 'Unicode normalization',
    },
    { input: [''], expected: '', description: 'Empty string' },
];

const getSegmentExamples = [
    { input: ['a-b-c', '-', 1], expected: 'a', description: 'First segment' },
    { input: ['a-b-c', '-', 3], expected: 'c', description: 'Third segment' },
    {
        input: ['path/to/resource', '/', 2],
        expected: 'to',
        description: 'Path segment',
    },
    { input: [null, '/', 1], expected: null, description: 'Null input' },
];

const getDomainNameExamples = [
    {
        input: ['https://www.example.com/path'],
        expected: 'example.com',
        description: 'Remove www',
    },
    {
        input: ['https://sub.example.com/path', false],
        expected: 'sub.example.com',
        description: 'Keep subdomain',
    },
    { input: ['invalid-url'], expected: null, description: 'Invalid URL' },
];

const joinPathsExamples = [
    {
        input: ['api', 'v1', 'users'],
        expected: 'api/v1/users',
        description: 'Basic join',
    },
    {
        input: ['/api/', '/v1/', '/users/'],
        expected: '/api/v1/users',
        description: 'Clean slashes',
    },
    { input: [''], expected: '', description: 'Empty input' },
];

const isValidUrlExamples = [
    {
        input: ['https://example.com'],
        expected: true,
        description: 'Valid HTTPS',
    },
    { input: ['not-a-url'], expected: false, description: 'Invalid URL' },
    { input: [''], expected: false, description: 'Empty string' },
];

// Meta configuration
const meta: Meta = {
    title: 'URL Functions',
    parameters: {
        docs: {
            description: {
                component: 'Testing and documentation for URL utility functions from @ottabase/utils',
            },
        },
    },
};

export default meta;
type Story = StoryObj;

// Story exports
export const InteractiveTest: Story = {
    render: () => <InteractiveTester />,
    parameters: {
        docs: {
            description: {
                story: 'Interactive tester for URL utility functions. Enter text and see results in real-time.',
            },
        },
    },
};

export const MakeSlugTests: Story = {
    render: () => <FunctionDemo title="makeSlug()" fn={makeSlug} examples={makeSlugExamples} />,
    parameters: {
        docs: {
            description: {
                story: 'Test cases for the makeSlug function showing input, output, and expected results.',
            },
        },
    },
};

export const GetSegmentTests: Story = {
    render: () => <FunctionDemo title="getSegment()" fn={getSegment} examples={getSegmentExamples} />,
    parameters: {
        docs: {
            description: {
                story: 'Test cases for the getSegment function.',
            },
        },
    },
};

export const GetDomainNameTests: Story = {
    render: () => <FunctionDemo title="getDomainName()" fn={getDomainName} examples={getDomainNameExamples} />,
    parameters: {
        docs: {
            description: {
                story: 'Test cases for the getDomainName function.',
            },
        },
    },
};

export const JoinPathsTests: Story = {
    render: () => <FunctionDemo title="joinPaths()" fn={joinPaths} examples={joinPathsExamples} />,
    parameters: {
        docs: {
            description: {
                story: 'Test cases for the joinPaths function.',
            },
        },
    },
};

export const IsValidUrlTests: Story = {
    render: () => <FunctionDemo title="isValidUrl()" fn={isValidUrl} examples={isValidUrlExamples} />,
    parameters: {
        docs: {
            description: {
                story: 'Test cases for the isValidUrl function.',
            },
        },
    },
};
