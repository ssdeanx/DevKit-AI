import React, { useState, useEffect } from 'react';
import { BookOpenIcon } from '../components/icons';
import ViewHeader from '../components/ViewHeader';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { Card, CardContent } from '../components/ui/Card';
import { cn } from '../lib/utils';

interface DocPage {
    path: string;
    title: string;
    subtitle: string;
}

interface DocSection {
    title: string;
    pages: DocPage[];
}

interface DocManifest {
    title: string;
    version: string;
    lastUpdated: string;
    sections: DocSection[];
}

const DocumentationView: React.FC = () => {
    const [manifest, setManifest] = useState<DocManifest | null>(null);
    const [activePage, setActivePage] = useState<DocPage | null>(null);
    const [pageContent, setPageContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchManifest = async () => {
            try {
                const response = await fetch('/docs/manifest.json');
                if (!response.ok) {
                    throw new Error('Failed to load documentation manifest.');
                }
                const data: DocManifest = await response.json();
                setManifest(data);
                if (data.sections && data.sections[0]?.pages[0]) {
                    setActivePage(data.sections[0].pages[0]);
                }
            } catch (e: any) {
                setError(e.message);
                setIsLoading(false);
            }
        };
        fetchManifest();
    }, []);

    useEffect(() => {
        if (!activePage) return;

        const fetchPageContent = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(activePage.path);
                 if (!response.ok) {
                    throw new Error(`Failed to load ${activePage.title}.`);
                }
                const text = await response.text();
                setPageContent(text);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPageContent();
    }, [activePage]);
    
    const getHeaderDescription = () => {
        if (!manifest) {
            return "Learn how the application works, its features, and its architecture.";
        }
        const formattedDate = new Date(manifest.lastUpdated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        return `Version ${manifest.version} | Last Updated: ${formattedDate}`;
    };

    return (
        <div className="flex flex-col h-full">
            <ViewHeader
                icon={<BookOpenIcon className="w-6 h-6" />}
                title={manifest?.title || "Project Documentation"}
                description={getHeaderDescription()}
            />
            <div className="flex-1 flex gap-6 p-6 overflow-hidden">
                {/* Docs Navigation Sidebar */}
                <Card className="w-1/6 h-full flex-shrink-0 overflow-y-auto custom-scrollbar">
                    <CardContent className="p-4">
                        <nav className="space-y-4">
                            {manifest?.sections.map(section => (
                                <div key={section.title}>
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{section.title}</h3>
                                    <div className="space-y-1">
                                        {section.pages.map(page => (
                                            <button
                                                key={page.path}
                                                onClick={() => setActivePage(page)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-md transition-colors",
                                                    activePage?.path === page.path
                                                        ? "bg-primary text-primary-foreground"
                                                        : "hover:bg-accent"
                                                )}
                                            >
                                                <p className="text-sm font-medium">{page.title}</p>
                                                <p className={cn(
                                                    "text-xs",
                                                    activePage?.path === page.path ? "text-primary-foreground/70" : "text-muted-foreground"
                                                )}>{page.subtitle}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </nav>
                    </CardContent>
                </Card>

                {/* Docs Content */}
                <Card className="w-5/6 h-full flex-1">
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <CardContent className="p-6">
                            {isLoading && <p className="text-muted-foreground">Loading...</p>}
                            {error && <p className="text-destructive">{error}</p>}
                            {!isLoading && !error && <MarkdownRenderer content={pageContent} />}
                        </CardContent>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default DocumentationView;