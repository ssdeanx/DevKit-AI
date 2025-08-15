import React, { useState, useContext, useEffect } from 'react';
import { GithubContext } from '../context/GithubContext';
import { GithubIcon } from '../components/icons';
import { FileNode } from '../services/github.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';

const GITHUB_API_KEY_STORAGE_KEY = 'devkit-github-api-key';

const FileTree: React.FC<{ tree: FileNode[] }> = ({ tree }) => {
  const renderNode = (node: FileNode, level = 0) => (
    <div key={node.name} style={{ paddingLeft: `${level * 20}px` }}>
      <span className="flex items-center py-1">
        <span className="mr-2">{node.type === 'dir' ? '📁' : '📄'}</span>
        {node.name}
      </span>
      {node.children && node.children.map(child => renderNode(child, level + 1))}
    </div>
  );

  return <div className="font-mono text-sm text-foreground/80">{tree.map(node => renderNode(node))}</div>;
};


const GithubInspectorView: React.FC = () => {
    const [urlInput, setUrlInput] = useState('https://github.com/google/generative-ai-docs');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(GITHUB_API_KEY_STORAGE_KEY) || '');
    const { repoUrl, fileTree, isLoading, error, fetchRepo } = useContext(GithubContext);

    useEffect(() => {
        localStorage.setItem(GITHUB_API_KEY_STORAGE_KEY, apiKey);
    }, [apiKey]);

    const handleFetch = () => {
        if (urlInput.trim()) {
            fetchRepo(urlInput.trim(), apiKey.trim());
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
            <header className="p-6 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
                <h1 className="text-2xl font-bold">GitHub Inspector</h1>
                <p className="text-sm text-muted-foreground">Load a public GitHub repository to provide context to the AI agents.</p>
            </header>
            <div className="flex-1 flex flex-col p-6 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Load Repository</CardTitle>
                        <CardDescription>Enter a public repository URL and an optional API key for higher rate limits.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="repo-url">Repository URL</Label>
                                <Input
                                    id="repo-url"
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="e.g., https://github.com/owner/repo"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="api-key">GitHub API Key (Optional)</Label>
                                <Input
                                    id="api-key"
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your personal access token"
                                />
                            </div>
                        </div>
                        <Button onClick={handleFetch} disabled={isLoading} size="lg">
                            {isLoading ? 'Loading...' : 'Load Repository'}
                        </Button>
                         {error && <p className="text-sm text-destructive mt-4 p-3 bg-destructive/10 rounded-md">{error}</p>}
                    </CardContent>
                </Card>

                <Card className="flex-1 flex flex-col">
                    <CardHeader>
                        <CardTitle>Repository Structure</CardTitle>
                        {repoUrl && <CardDescription className="font-mono text-primary/80">{repoUrl}</CardDescription>}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {isLoading && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <svg className="animate-spin h-8 w-8 text-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}
                        
                        {!isLoading && fileTree && <FileTree tree={fileTree} />}

                        {!isLoading && !fileTree && !error && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <GithubIcon className="w-12 h-12 mx-auto mb-2" />
                                    <p>Repository file tree will be displayed here.</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default GithubInspectorView;
