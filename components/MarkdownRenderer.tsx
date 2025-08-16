
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/Button';
import { ClipboardCopyIcon, CheckCircleIcon } from './icons';

// Declare mermaid for TypeScript
declare const mermaid: {
    run: () => void;
};

const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'text';
    const codeContent = String(children).replace(/\n$/, '');
    
    const [isCopied, setIsCopied] = useState(false);

    // MERMAID RENDERING IS NOW HANDLED BY THE PARENT COMPONENT'S useEffect

    const handleCopy = () => {
        navigator.clipboard.writeText(codeContent);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (lang === 'mermaid') {
        return (
             <div className="bg-background rounded-md my-2 p-4 flex justify-center items-center">
                {/* This div is now targeted by mermaid.run() */}
                <div className="mermaid">{codeContent}</div>
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
                        <CheckCircleIcon className="w-3 h-3 mr-1" />
                    ) : (
                        <ClipboardCopyIcon className="w-3 h-3 mr-1" />
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

    // THIS IS THE FIX:
    // This effect runs after the markdown content has been rendered to the DOM.
    // It finds all elements with the "mermaid" class and tells the mermaid library to render them.
    // This is more robust than trying to render each diagram individually.
    useEffect(() => {
        try {
            if ((window as any).mermaid) {
                (window as any).mermaid.run();
            }
        } catch(e) {
            console.error("Error rendering mermaid diagrams", e);
        }
    }, [content]); // Re-run this effect whenever the markdown content changes

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({node, ...props}) => <h1 className="text-3xl font-bold my-4 pb-2 border-b" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-2xl font-semibold my-3 pb-2 border-b" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-xl font-semibold my-2" {...props} />,
                p: ({node, ...props}) => <p className="my-4 leading-relaxed" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-6 my-4 space-y-2" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-4 space-y-2" {...props} />,
                li: ({node, ...props}) => <li className="my-1" {...props} />,
                code({ node, inline, className, children, ...props }: any) {
                    return !inline ? (
                        <CodeBlock className={className}>{children}</CodeBlock>
                    ) : (
                        <code className="bg-muted text-muted-foreground font-mono py-0.5 px-1 rounded-sm text-sm" {...props}>
                            {children}
                        </code>
                    );
                },
                table: ({node, ...props}) => <div className="overflow-x-auto"><table className="table-auto w-full my-4 border-collapse border border-border" {...props} /></div>,
                thead: ({node, ...props}) => <thead className="bg-muted" {...props} />,
                th: ({node, ...props}) => <th className="border border-border px-4 py-2 text-left font-semibold" {...props} />,
                td: ({node, ...props}) => <td className="border border-border px-4 py-2" {...props} />,
                a: ({node, ...props}) => <a className="text-primary underline hover:no-underline" {...props} />,
                hr: ({node, ...props}) => <hr className="my-6 border-border" {...props} />,
            }}
        >
            {content}
        </ReactMarkdown>
    );
};

export default MarkdownRenderer;
