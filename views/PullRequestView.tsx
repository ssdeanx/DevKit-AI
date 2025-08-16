

import React, { useState } from 'react';
import { GitPullRequestIcon, SparklesIcon, GithubIcon } from '../components/icons';
import ViewHeader from '../components/ViewHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { githubService, StagedFile } from '../services/github.service';
import { useToast } from '../context/ToastContext';
import { supervisor } from '../services/supervisor';
import { PullRequestAgent } from '../agents/PullRequestAgent';
import { useStreamingOperation } from '../hooks/useStreamingOperation';
import MarkdownRenderer from '../components/MarkdownRenderer';
import EmptyState from '../components/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';

const PullRequestReviewer: React.FC = () => {
    const [prUrl, setPrUrl] = useState('');
    const [fetchedFiles, setFetchedFiles] = useState<StagedFile[] | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const { toast } = useToast();

    const reviewOperation = useStreamingOperation(async () => {
        if (!fetchedFiles || fetchedFiles.length === 0) {
            throw new Error("No files from the pull request are available for review.");
        }
        
        const prompt = `Please review the code changes in the following files from a pull request. The URL of the PR is: ${prUrl}. Provide a comprehensive review covering potential bugs, style issues, and adherence to best practices. Offer constructive suggestions for improvement.`;
        
        return supervisor.handleRequest(prompt, { fileTree: null, stagedFiles: fetchedFiles }, { setActiveView: () => {} }, PullRequestAgent.id);
    });

    const handleFetchPr = async () => {
        if (!prUrl.trim()) {
            toast({ title: 'Error', description: 'Please enter a valid Pull Request URL.', variant: 'destructive' });
            return;
        }
        setIsFetching(true);
        setFetchedFiles(null);
        reviewOperation.reset(); // Reset any previous review
        try {
            const files = await githubService.fetchPullRequestFiles(prUrl);
            setFetchedFiles(files);
            toast({ title: 'Success', description: `Fetched ${files.length} changed file(s) from the PR.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsFetching(false);
        }
    };

    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
            {/* Control Panel */}
            <div className="md:col-span-1 flex flex-col h-full">
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader>
                        <CardTitle>Pull Request URL</CardTitle>
                        <CardDescription>Enter the URL of a public GitHub pull request to analyze.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <Input
                            placeholder="https://github.com/owner/repo/pull/123"
                            value={prUrl}
                            onChange={(e) => setPrUrl(e.target.value)}
                        />
                         <Button onClick={handleFetchPr} disabled={isFetching}>
                            {isFetching ? 'Fetching PR...' : 'Fetch PR Files'}
                        </Button>
                        
                        {fetchedFiles && (
                             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 border-t pt-4">
                                <h4 className="font-semibold text-sm">Changed Files ({fetchedFiles.length}):</h4>
                                {fetchedFiles.map(file => (
                                    <div key={file.path} className="text-xs p-2 bg-secondary rounded truncate" title={file.path}>
                                        {file.path}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <Button
                            onClick={reviewOperation.execute}
                            disabled={reviewOperation.isLoading || !fetchedFiles || fetchedFiles.length === 0}
                            size="lg"
                            className="mt-auto"
                        >
                            {reviewOperation.isLoading ? 'Generating Review...' : "Generate AI Review"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Canvas */}
            <div className="md:col-span-2 h-full flex flex-col relative aurora-canvas canvas-background">
                <div className="flex justify-between items-center p-4 border-b border-border/50 relative z-10">
                    <h3 className="text-lg font-semibold">Generated Code Review</h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
                    {!reviewOperation.content && !reviewOperation.isLoading && (
                        <div className="h-full flex items-center justify-center">
                            <EmptyState
                                icon={<GitPullRequestIcon className="w-12 h-12" />}
                                title="Ready for review"
                                description='Fetch a pull request and click "Generate AI Review" to see the result.'
                            />
                        </div>
                    )}
                    
                    {reviewOperation.content && (
                        <MarkdownRenderer content={reviewOperation.content} />
                    )}
                </div>

                {reviewOperation.isLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
                        <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                        <h3 className="text-xl font-semibold mt-4">Generating Review...</h3>
                        <p className="text-muted-foreground mt-1">The `PullRequestAgent` is analyzing the changes.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const GitHubProView: React.FC = () => {
    return (
        <div className="flex flex-col h-full">
            <ViewHeader
                icon={<GithubIcon className="w-6 h-6" />}
                title="GitHub Pro"
                description="Advanced tools for deep GitHub workflow integration."
            />
            <Tabs defaultValue="pr-reviewer" className="flex-1 flex flex-col">
                <div className="px-6">
                    <TabsList>
                        <TabsTrigger value="pr-reviewer">Pull Request Reviewer</TabsTrigger>
                        <TabsTrigger value="coming-soon" disabled>Coming Soon...</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="pr-reviewer" className="flex-1 flex flex-col mt-0">
                    <PullRequestReviewer />
                </TabsContent>
            </Tabs>
        </div>
    );
};


export default GitHubProView;