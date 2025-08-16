
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/Button';
import { ClipboardCopyIcon, CheckCircleIcon } from './icons';

// Declare mermaid for TypeScript
declare const mermaid: {
    render: (id: string, text: string, callback: (svgCode: string) => void) => void;
};

const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'text';
    const codeContent = String(children).replace(/\n$/, '');
    
    const mermaidRef = useRef<HTMLDivElement>(null);
    const hasRendered = useRef(false);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (lang === 'mermaid' && mermaidRef.current && !hasRendered.current) {
            try {
                const id = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;
                mermaid.render(id, codeContent, (svgCode) => {
                    if (mermaidRef.current) {
                        mermaidRef.current.innerHTML = svgCode;
                        hasRendered.current = true;
                    }
                });
            } catch (error) {
                console.error("Mermaid rendering error:", error);
                if (mermaidRef.current) {
                    mermaidRef.current.innerText = "Error rendering Mermaid diagram.";
                }
            }
        }
    }, [codeContent, lang]);

    const handleCopy = () => {
        navigator.clipboard.writeText(codeContent);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (lang === 'mermaid') {
        return (
             <div className="bg-background rounded-md my-2 p-4 flex justify-center items-center">
                <div ref={mermaidRef} className="mermaid">{codeContent}</div>
             </div>
        )
    }

    return (
        <div className="bg-background rounded-md my-2 text-sm text-foreground relative group">
            <div className="bg-muted px-3 py-1 text-xs text-muted-foreground rounded-t-md flex justify-between items-center">
                <span>{lang}</span>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopy} 
                    className="h-auto px-2 py-0.5 text-xs"
                    disabled={isCopied}
                    data-tooltip={isCopied ? "Copied!" : "Copy code"}
                >
                    {isCopied ? (
                        <>
                            <CheckCircleIcon className="w-3 h-3 mr-1" />
                        </>
                    ) : (
                         <>
                            <ClipboardCopyIcon className="w-3 h-3 mr-1" />
                        </>
                    )}
                </Button>
            </div>
            <pre className="p-3 overflow-x-auto">
                <code>{children}</code>
            </pre>
        </div>
    );
};


const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, inline, className, children, ...props }: any) {
                    return !inline ? (
                        <CodeBlock className={className}>{children}</CodeBlock>
                    ) : (
                        <code className="bg-muted text-muted-foreground font-mono py-0.5 px-1 rounded-sm text-sm" {...props}>
                            {children}
                        </code>
                    );
                },
                table: ({node, ...props}) => <table className="table-auto w-full my-2 border-collapse border border-border" {...props} />,
                thead: ({node, ...props}) => <thead className="bg-muted" {...props} />,
                th: ({node, ...props}) => <th className="border border-border px-4 py-2 text-left font-semibold" {...props} />,
                td: ({node, ...props}) => <td className="border border-border px-4 py-2" {...props} />,
                a: ({node, ...props}) => <a className="text-primary underline hover:no-underline" {...props} />,
            }}
        >
            {content}
        </ReactMarkdown>
    );
};

export default MarkdownRenderer;