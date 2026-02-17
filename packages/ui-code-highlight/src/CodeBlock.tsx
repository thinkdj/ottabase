'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js/lib/core';

// Import common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('jsx', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);

export interface CodeBlockProps {
    code: string;
    language?: string;
    filename?: string;
    showLineNumbers?: boolean;
    className?: string;
}

export function CodeBlock({
    code,
    language = 'plaintext',
    filename,
    showLineNumbers = false,
    className = '',
}: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (codeRef.current) {
            // Highlight the code
            hljs.highlightElement(codeRef.current);
        }
    }, [code, language]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const lines = code.split('\n');

    return (
        <div className={`code-block-wrapper rounded-lg overflow-hidden border ${className}`}>
            {/* Header with filename and copy button */}
            <div className="code-block-header flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    {filename && <span className="text-xs font-medium text-muted-foreground">{filename}</span>}
                    {!filename && language !== 'plaintext' && (
                        <span className="text-xs font-medium text-muted-foreground uppercase">{language}</span>
                    )}
                </div>
                <button
                    onClick={handleCopy}
                    className="code-block-copy-btn flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-muted"
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code content */}
            <div className="code-block-content relative">
                <pre className={`!m-0 overflow-x-auto ${showLineNumbers ? '!pl-12 !pr-4 !py-4' : '!p-4'}`}>
                    <code ref={codeRef} className={`language-${language} !bg-transparent`}>
                        {code}
                    </code>
                </pre>
                {showLineNumbers && (
                    <div className="code-block-line-numbers absolute top-0 left-0 p-4 pr-2 select-none pointer-events-none text-muted-foreground/40">
                        {lines.map((_, i) => (
                            <div key={i} className="leading-[1.5]">
                                {i + 1}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
