'use client';

import { memo, useMemo, useState } from 'react';
import { Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';
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
import ini from 'highlight.js/lib/languages/ini';

// Register languages (ini supports toml-like syntax)
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
hljs.registerLanguage('zsh', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('toml', ini);

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Parse "3,5-7,9" into [3,5,6,7,9] */
function parseHighlightLines(spec: string | number[] | { start: number; end: number }[]): Set<number> {
    const set = new Set<number>();
    if (Array.isArray(spec)) {
        for (const item of spec) {
            if (typeof item === 'number') set.add(item);
            else if (typeof item === 'object' && 'start' in item && 'end' in item) {
                for (let i = item.start; i <= item.end; i++) set.add(i);
            }
        }
        return set;
    }
    const s = String(spec).trim();
    if (!s) return set;
    for (const part of s.split(/[,;]/)) {
        const dash = part.indexOf('-');
        if (dash >= 0) {
            const a = parseInt(part.slice(0, dash), 10);
            const b = parseInt(part.slice(dash + 1), 10);
            for (let i = a; i <= b; i++) set.add(i);
        } else {
            const n = parseInt(part, 10);
            if (!isNaN(n)) set.add(n);
        }
    }
    return set;
}

export interface CodeBlockProps {
    code: string;
    language?: string;
    filename?: string;
    showLineNumbers?: boolean;
    lineNumberStart?: number;
    maxHeight?: string;
    wrapLongLines?: boolean;
    hideHeader?: boolean;
    hideCopyButton?: boolean;
    highlightLines?: string | number[] | { start: number; end: number }[];
    tabSize?: number;
    collapsible?: boolean;
    collapsibleThreshold?: number;
    className?: string;
}

function CodeBlockInner({
    code,
    language = 'plaintext',
    filename,
    showLineNumbers = false,
    lineNumberStart = 1,
    maxHeight,
    wrapLongLines = false,
    hideHeader = false,
    hideCopyButton = false,
    highlightLines,
    tabSize = 4,
    collapsible = false,
    collapsibleThreshold = 20,
    className = '',
}: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(true);

    // lineNumberStart: default 1 if not set, or if 0 / alphabets / invalid
    const start = Math.max(1, Math.floor(Number(lineNumberStart)) || 1);

    const lines = code.split('\n');
    const shouldCollapse = collapsible && lines.length > collapsibleThreshold;
    const highlightSet = highlightLines ? parseHighlightLines(highlightLines) : null;

    const highlightedHtml = useMemo(() => {
        try {
            const result = hljs.highlight(code, { language });
            return result.value;
        } catch {
            return escapeHtml(code);
        }
    }, [code, language]);

    // Split highlighted HTML by lines so we can render line numbers inline (scroll together)
    const lineHtmls = useMemo(() => highlightedHtml.split('\n'), [highlightedHtml]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const preStyle: React.CSSProperties = useMemo(() => {
        const s: React.CSSProperties = {};
        if (wrapLongLines) s.whiteSpace = 'pre-wrap';
        if (tabSize) s.tabSize = tabSize;
        if (maxHeight) s.maxHeight = maxHeight;
        return s;
    }, [wrapLongLines, tabSize, maxHeight]);

    return (
        <div className={`code-block-wrapper rounded-lg overflow-hidden border ${className}`}>
            {!hideHeader && (
                <div className="code-block-header flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        {filename && <span className="text-xs font-medium text-muted-foreground">{filename}</span>}
                        {!filename && language !== 'plaintext' && (
                            <span className="text-xs font-medium text-muted-foreground uppercase">{language}</span>
                        )}
                    </div>
                    {!hideCopyButton && (
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
                    )}
                </div>
            )}

            <div className="code-block-content relative">
                {shouldCollapse && (
                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        className="code-block-collapse-btn absolute top-1 right-2 z-10 flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                    >
                        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {expanded ? 'Collapse' : `Expand (${lines.length} lines)`}
                    </button>
                )}

                {(!shouldCollapse || expanded) && (
                    <pre
                        className={`code-block-pre !m-0 overflow-x-auto overflow-y-auto ${showLineNumbers ? 'code-block-with-lines' : ''}`}
                        style={preStyle}
                    >
                        {showLineNumbers ? (
                            lineHtmls.map((lineHtml, i) => {
                                const num = start + i;
                                const isHighlighted = highlightSet?.has(num) ?? false;
                                return (
                                    <span key={i} className="code-block-line">
                                        <span
                                            className={`code-block-line-num select-none ${isHighlighted ? 'code-line-highlight font-semibold' : ''}`}
                                        >
                                            {num}
                                        </span>
                                        <span
                                            className={`hljs language-${language} !bg-transparent`}
                                            dangerouslySetInnerHTML={{ __html: lineHtml || ' ' }}
                                        />
                                    </span>
                                );
                            })
                        ) : (
                            <code
                                className={`hljs language-${language} !bg-transparent`}
                                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                            />
                        )}
                    </pre>
                )}

                {shouldCollapse && !expanded && (
                    <div className="p-4 text-xs text-muted-foreground">{lines.length} lines • Click to expand</div>
                )}
            </div>
        </div>
    );
}

export const CodeBlock = memo(CodeBlockInner);
