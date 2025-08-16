
import React, { useState, useContext } from 'react';
import { GithubIcon, SparklesIcon, GitPullRequestIcon, RefreshCwIcon, SearchIcon, TagsIcon } from '../components/icons';
import ViewHeader from '../components/ViewHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { githubService, StagedFile, PullRequestSummary, RepoSearchResult, IssueDetails, RepoLabel } from '../services/github.service';
import { supervisor } from '../services/supervisor';
import { PullRequestAgent } from '../agents/PullRequestAgent';
import { useStreamingOperation } from '../hooks/useStreamingOperation';
import MarkdownRenderer from '../components/MarkdownRenderer';
import EmptyState from '../components/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { GithubContext } from '../context/GithubContext';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { ViewName } from '../App';
import { cn } from '../lib/utils';
import { IssueLabelAgent } from '../agents/IssueLabelAgent';

const MyPullRequests: React.FC = () => {
    const { apiKey } = useContext(GithubContext);
    const { data: prs, isLoading, error, execute: fetchPrs } = useAsyncOperation(githubService.fetchUserPullRequests);
    const [selectedPr, setSelectedPr] = useState<PullRequestSummary | null>(null);
    const [fetchedFiles, setFetchedFiles] = useState<StagedFile[] | null>(null);
    
    const fetchPrFiles = useAsyncOperation(githubService.fetchPullRequestFiles);

    const reviewOperation = useStreamingOperation(async () => {
        if (!fetchedFiles || fetchedFiles.length === 0 || !selectedPr) {
            throw new Error("No files from the pull request are available for review.");
        }
        const prompt = `Please review the code changes in the following files from a pull request. The URL of the PR is: ${selectedPr.url}. Provide a comprehensive review covering potential bugs, style issues, and adherence to best practices. Offer constructive suggestions for improvement.`;
        return supervisor.handleRequest(prompt, { fileTree: null, stagedFiles: fetchedFiles, apiKey }, { setActiveView: () => {} }, PullRequestAgent.id);
    });

    const handleSelectPr = async (pr: PullRequestSummary) => {
        setSelectedPr(pr);
        reviewOperation.reset();
        const files = await fetchPrFiles.execute(pr.url, apiKey);
        setFetchedFiles(files || []);
    };

    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
            {/* PR List Panel */}
            <div className="md:col-span-1 flex flex-col h-full">
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>My Open PRs</CardTitle>
                                <CardDescription>Assigned to you.</CardDescription>
                            </div>
                            <Button onClick={() => fetchPrs(apiKey)} disabled={isLoading} size="sm" variant="outline">
                                <RefreshCwIcon className="w-4 h-4 mr-2"/>
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoading && <p>Loading your pull requests...</p>}
                        {error && <p className="text-destructive">{error}</p>}
                        {!isLoading && !prs && <p>Click Refresh to load your assigned pull requests.</p>}
                        {prs && prs.length === 0 && <p>You have no open pull requests assigned to you.</p>}
                        {prs && prs.length > 0 && (
                            <div className="space-y-2">
                                {prs.map(pr => (
                                    <div
                                        key={pr.url}
                                        className={cn('p-3 border rounded-lg hover:bg-accent cursor-pointer', selectedPr?.url === pr.url && 'bg-accent border-primary/50')}
                                        onClick={() => handleSelectPr(pr)}
                                    >
                                        <p className="font-semibold">{pr.title}</p>
                                        <p className="text-sm text-muted-foreground">{pr.repo} #{pr.number}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
             {/* Review Canvas */}
             <div className="md:col-span-2 h-full flex flex-col relative aurora-canvas canvas-background">
                <div className="flex justify-between items-center p-4 border-b border-border/50 relative z-10">
                    <h3 className="text-lg font-semibold truncate">
                        {selectedPr ? `Review for: ${selectedPr.title}` : 'Generated Code Review'}
                    </h3>
                     <Button
                        onClick={reviewOperation.execute}
                        disabled={reviewOperation.isLoading || !fetchedFiles || fetchedFiles.length === 0}
                        size="sm"
                    >
                        {reviewOperation.isLoading ? 'Generating...' : "Generate AI Review"}
                    </Button>
                </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
                    {fetchPrFiles.isLoading && <p>Fetching PR details...</p>}
                    {!reviewOperation.content && !reviewOperation.isLoading && !selectedPr && (
                        <div className="h-full flex items-center justify-center">
                            <EmptyState
                                icon={<GitPullRequestIcon className="w-12 h-12" />}
                                title="Select a Pull Request"
                                description='Choose a PR from the list to fetch its details and generate a review.'
                            />
                        </div>
                    )}
                    {reviewOperation.content && <MarkdownRenderer content={reviewOperation.content} />}
                 </div>
                 {reviewOperation.isLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
                        <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                        <h3 className="text-xl font-semibold mt-4">Generating Review...</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

const RepoSearch: React.FC<{ setActiveView: (view: ViewName) => void }> = ({ setActiveView }) => {
    const { apiKey, fetchRepo } = useContext(GithubContext);
    const [query, setQuery] = useState('');
    const { data: repos, isLoading, error, execute: searchRepos } = useAsyncOperation(githubService.searchRepositories);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if(query.trim()) {
            searchRepos(query, apiKey);
        }
    };

    const handleLoadRepo = (url: string) => {
        fetchRepo(url).then(() => {
            setActiveView('github-inspector');
        });
    };

    return (
        <div className="flex-1 p-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Repository Search</CardTitle>
                    <CardDescription>Search for public repositories on GitHub to analyze.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                        <Input 
                            placeholder="Search for repositories..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <Button type="submit" disabled={isLoading}>
                            <SearchIcon className="w-4 h-4 mr-2"/>
                            Search
                        </Button>
                    </form>
                    {isLoading && <p>Searching...</p>}
                    {error && <p className="text-destructive">{error}</p>}
                    {repos && (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            {repos.map(repo => (
                                <div key={repo.id} className="p-3 border rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-primary">{repo.fullName}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{repo.description}</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => handleLoadRepo(repo.url)}>
                                            Load in Inspector
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">⭐ {repo.stars.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const IssueLabeler: React.FC = () => {
    const [issueUrl, setIssueUrl] = useState('');
    const { apiKey } = useContext(GithubContext);

    const labelOperation = useStreamingOperation(async () => {
        if (!issueUrl.trim()) throw new Error("Please enter a GitHub issue URL.");
        const prompt = `Please analyze and apply labels to the following GitHub issue: ${issueUrl}`;
        return supervisor.handleRequest(prompt, { fileTree: null, stagedFiles: [], apiKey }, { setActiveView: () => {} }, IssueLabelAgent.id);
    });

    return (
        <div className="flex-1 p-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>AI Issue Labeler</CardTitle>
                    <CardDescription>Automatically suggest and apply labels to any GitHub issue.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-6">
                        <Input 
                            placeholder="Paste GitHub Issue URL..."
                            value={issueUrl}
                            onChange={(e) => setIssueUrl(e.target.value)}
                        />
                        <Button onClick={labelOperation.execute} disabled={labelOperation.isLoading}>
                            <TagsIcon className="w-4 h-4 mr-2"/>
                            Suggest & Apply Labels
                        </Button>
                    </div>
                    {(labelOperation.isLoading || labelOperation.thoughts || labelOperation.content || labelOperation.error) && (
                        <div className="p-4 border rounded-lg bg-muted/30 min-h-[200px]">
                            {labelOperation.isLoading && <p>AI is analyzing the issue...</p>}
                            {labelOperation.error && <p className="text-destructive">{labelOperation.error}</p>}
                            {labelOperation.thoughts && <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono mb-4">THOUGHTS: {labelOperation.thoughts}</pre>}
                            {labelOperation.content && <MarkdownRenderer content={labelOperation.content} />}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};


const GitHubProView: React.FC<{ setActiveView: (view: ViewName) => void }> = ({ setActiveView }) => {
    const { apiKey } = useContext(GithubContext);

    return (
        <div className="flex flex-col h-full">
            <ViewHeader
                icon={<GithubIcon className="w-6 h-6" />}
                title="GitHub Pro"
                description="Advanced tools for deep GitHub workflow integration."
            />
            {!apiKey ? (
                 <div className="flex-1 p-6">
                    <EmptyState
                        icon={<GithubIcon className="w-12 h-12" />}
                        title="API Key Required"
                        description="Please add a GitHub API key in the 'GitHub Inspector' view to unlock these features."
                    />
                </div>
            ) : (
                <Tabs defaultValue="pr-reviewer" className="flex-1 flex flex-col">
                    <div className="px-6">
                        <TabsList>
                            <TabsTrigger value="pr-reviewer">My Pull Requests</TabsTrigger>
                            <TabsTrigger value="issue-labeler">AI Issue Labeler</TabsTrigger>
                            <TabsTrigger value="repo-search">Repository Search</TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="pr-reviewer" className="flex-1 flex flex-col mt-0">
                        <MyPullRequests />
                    </TabsContent>
                    <TabsContent value="issue-labeler" className="flex-1 flex flex-col mt-0">
                        <IssueLabeler />
                    </TabsContent>
                    <TabsContent value="repo-search" className="flex-1 flex flex-col mt-0">
                        <RepoSearch setActiveView={setActiveView} />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
};

export default GitHubProView;
