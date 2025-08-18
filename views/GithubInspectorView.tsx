
import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { GithubContext } from '../context/GithubContext';
import { GithubIcon, FilesIcon, FileMinusIcon } from '../components/icons';
import { FileNode, StagedFile } from '../services/github.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import ViewHeader from '../components/ViewHeader';
import { FileTree } from '../components/FileTree';

const StagedFiles: React.FC<{
    files: StagedFile[];
    onUnstage: (path: string) => void;
}> = ({ files, onUnstage }) => {
    if (files.length === 0) {
        return (
            <div className="text-center text-sm text-muted-foreground p-4">
                Click the '+' icon next to a file or folder in the tree to add it to the context.
            </div>
        );
    }

    return (
        <div className="space-y-2 p-2 h-full overflow-y-auto custom-scrollbar">
            {files.map(file => (
                <div key={file.path} className="group flex items-center justify-between bg-secondary/50 p-2 rounded text-sm">
                    <span className="truncate" title={file.path}>{file.path}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => onUnstage(file.path)}>
                        <FileMinusIcon className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                    </Button>
                </div>
            ))}
        </div>
    );
};

const GithubInspectorView: React.FC = () => {
    const [urlInput, setUrlInput] = useState('https://github.com/ssdeanx/DevKit-AI');
    const { 
        repoUrl, fileTree, isLoading, error, fetchRepo, 
        stagedFiles, stageFile, unstageFile, stageFolder, unstageFolder,
        stageAllFiles, unstageAllFiles, apiKey, setApiKey
    } = useContext(GithubContext);

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [isAllExpanded, setIsAllExpanded] = useState(false);

    const toggleFolder = useCallback((path: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    }, []);

    const expandAll = useCallback(() => {
        if (!fileTree) return;
        const allFolderPaths = new Set<string>();
        const traverse = (nodes: FileNode[]) => {
            nodes.forEach(node => {
                if (node.type === 'dir') {
                    allFolderPaths.add(node.path);
                    if (node.children) traverse(node.children);
                }
            });
        };
        traverse(fileTree);
        setExpandedFolders(allFolderPaths);
        setIsAllExpanded(true);
    }, [fileTree]);

    const collapseAll = useCallback(() => {
        setExpandedFolders(new Set());
        setIsAllExpanded(false);
    }, []);

    useEffect(() => {
        if (fileTree && !isAllExpanded) {
           expandAll();
        }
    }, [fileTree, isAllExpanded, expandAll]);

    const totalFiles = useMemo(() => {
        if (!fileTree) return 0;
        let count = 0;
        const countFiles = (nodes: FileNode[]) => {
            for (const node of nodes) {
                if (node.type === 'file') count++;
                if (node.children) countFiles(node.children);
            }
        };
        countFiles(fileTree);
        return count;
    }, [fileTree]);
    
    const handleFetch = () => {
        if (urlInput.trim()) {
            fetchRepo(urlInput.trim());
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <ViewHeader
                icon={<GithubIcon className="w-6 h-6" />}
                title="GitHub Inspector"
                description="Load a repository and stage files to provide context to the AI agents."
            />
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 p-6 gap-6 overflow-hidden">
                {/* Left Column */}
                <div className="flex flex-col gap-6 overflow-hidden">
                    <Card>
                        <CardHeader>
                            <CardTitle>Load Repository</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                <Label htmlFor="api-key">GitHub API Key (Optional but Recommended)</Label>
                                <Input
                                    id="api-key"
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter personal access token for higher rate limits & private repos"
                                />
                            </div>
                            <Button onClick={handleFetch} disabled={isLoading} size="lg" className="w-full">
                                {isLoading ? 'Loading Repository...' : 'Load Repository'}
                            </Button>
                             {error && <p className="text-sm text-destructive mt-4 p-3 bg-destructive/10 rounded-md">{error}</p>}
                        </CardContent>
                    </Card>
                    <Card className="flex-1 flex flex-col overflow-hidden">
                         <CardHeader>
                            <div className="flex justify-between items-center">
                                <div className="space-y-1.5">
                                    <CardTitle>Staged Files ({stagedFiles.length})</CardTitle>
                                    <CardDescription>The content of these files will be sent to context-aware agents.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline" onClick={() => stageAllFiles()} disabled={!fileTree || stagedFiles.length === totalFiles}>
                                        <FilesIcon className="w-4 h-4 mr-2" />
                                        Stage All
                                    </Button>
                                     <Button size="sm" variant="outline" onClick={unstageAllFiles} disabled={stagedFiles.length === 0}>
                                        <FileMinusIcon className="w-4 h-4 mr-2" />
                                        Unstage All
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden p-2">
                             <StagedFiles files={stagedFiles} onUnstage={unstageFile} />
                        </CardContent>
                    </Card>
                </div>
                
                {/* Right Column */}
                <div className="flex flex-col gap-6 overflow-hidden">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Repository Structure</CardTitle>
                                    {repoUrl && <CardDescription className="font-mono text-primary/80">{repoUrl.split('/').slice(-2).join('/')}</CardDescription>}
                                </div>
                                {fileTree && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={isAllExpanded ? collapseAll : expandAll}>
                                            {isAllExpanded ? "Collapse All" : "Expand All"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading && (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <svg className="animate-spin h-8 w-8 text-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                            
                            {!isLoading && fileTree && (
                                <FileTree 
                                    tree={fileTree} 
                                    stagedFiles={stagedFiles} 
                                    onStageFile={stageFile} 
                                    onStageFolder={stageFolder} 
                                    onUnstageFolder={unstageFolder}
                                    expandedFolders={expandedFolders}
                                    onToggleFolder={toggleFolder}
                                />
                            )}

                            {!isLoading && !fileTree && !error && (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center p-4 border-2 border-dashed rounded-lg">
                                        <GithubIcon className="w-12 h-12 mx-auto mb-2" />
                                        <p className="font-semibold text-foreground">Load a repository</p>
                                        <p className="text-sm">Enter a URL above to begin inspecting and staging files.</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default GithubInspectorView;