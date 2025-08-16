import React, { useState, useContext, useEffect, useMemo } from 'react';
import { GithubContext } from '../context/GithubContext';
import { GithubIcon, PlusCircleIcon, XCircleIcon, CheckCircleIcon, FilesIcon, FileMinusIcon } from '../components/icons';
import { FileNode, StagedFile } from '../services/github.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { cn } from '../lib/utils';
import ViewHeader from '../components/ViewHeader';


const GITHUB_API_KEY_STORAGE_KEY = 'devkit-github-api-key';

const getFilePathsFromNode = (node: FileNode): string[] => {
    let paths: string[] = [];
    if (node.type === 'file') {
        paths.push(node.path);
    } else if (node.type === 'dir' && node.children) {
        node.children.forEach(child => {
            paths.push(...getFilePathsFromNode(child));
        });
    }
    return paths;
};

const getFolderStagingStatus = (folderNode: FileNode, stagedFiles: StagedFile[]): 'none' | 'partial' | 'full' => {
    const allFiles = getFilePathsFromNode(folderNode);
    if (allFiles.length === 0) return 'none'; 
    const stagedFilePaths = new Set(stagedFiles.map(f => f.path));
    const stagedCount = allFiles.filter(path => stagedFilePaths.has(path)).length;
    if (stagedCount === 0) return 'none';
    if (stagedCount === allFiles.length) return 'full';
    return 'partial';
};


const FileTree: React.FC<{ 
    tree: FileNode[]; 
    stagedFiles: StagedFile[];
    onStageFile: (path: string) => void;
    onStageFolder: (path: string) => void;
    onUnstageFolder: (path: string) => void;
}> = ({ tree, stagedFiles, onStageFile, onStageFolder, onUnstageFolder }) => {
  const renderNode = (node: FileNode, level = 0) => {
    const isStaged = stagedFiles.some(f => f.path === node.path);
    const indent = level * 20;

    if (node.type === 'dir') {
        const status = getFolderStagingStatus(node, stagedFiles);
        let ActionIcon: React.FC<any> | null = null;
        let action: (() => void) | null = null;
        let tooltip: string | undefined = undefined;

        if (status === 'full') {
            ActionIcon = XCircleIcon;
            action = () => onUnstageFolder(node.path);
            tooltip = "Unstage all files in this folder";
        } else if (status === 'none' || status === 'partial') {
            ActionIcon = PlusCircleIcon;
            action = () => onStageFolder(node.path);
            tooltip = status === 'none' ? "Stage all files in this folder" : "Stage remaining files in this folder";
        }

        return (
            <div key={node.path}>
                <div className="group flex items-center py-1.5 px-2 hover:bg-accent/50 rounded" style={{ paddingLeft: `${indent}px` }}>
                    <span className="mr-2">📁</span>
                    <span className="flex-1 truncate" title={node.name}>{node.name}</span>
                    {ActionIcon && action && (
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={action}
                            data-tooltip={tooltip}
                        >
                            <ActionIcon className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>
                {node.children && node.children.map(child => renderNode(child, level + 1))}
            </div>
        );
    }
    
    // File node rendering
    return (
        <div key={node.path} style={{ paddingLeft: `${indent}px` }}>
            <div className="group flex items-center py-1.5 px-2 hover:bg-accent/50 rounded">
                <span className="mr-2">📄</span>
                <span className="flex-1 truncate" title={node.name}>{node.name}</span>
                {isStaged ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" title="File is staged" />
                ) : (
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => onStageFile(node.path)}
                        data-tooltip="Stage file for context"
                    >
                        <PlusCircleIcon className="w-4 h-4 text-muted-foreground" />
                    </Button>
                )}
            </div>
        </div>
    );
  };

  return <div className="font-mono text-sm text-foreground/80">{tree.map(node => renderNode(node))}</div>;
};

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
        <div className="space-y-2 p-2 max-h-48 overflow-y-auto custom-scrollbar">
            {files.map(file => (
                <div key={file.path} className="group flex items-center justify-between bg-secondary/50 p-2 rounded text-sm">
                    <span className="truncate" title={file.path}>{file.path}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => onUnstage(file.path)}>
                        <XCircleIcon className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                    </Button>
                </div>
            ))}
        </div>
    );
};


const GithubInspectorView: React.FC = () => {
    const [urlInput, setUrlInput] = useState('https://github.com/ssdeanx/DevKit-AI');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(GITHUB_API_KEY_STORAGE_KEY) || '');
    const { 
        repoUrl, fileTree, isLoading, error, fetchRepo, 
        stagedFiles, stageFile, unstageFile, stageFolder, unstageFolder,
        stageAllFiles, unstageAllFiles 
    } = useContext(GithubContext);

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

    useEffect(() => {
        localStorage.setItem(GITHUB_API_KEY_STORAGE_KEY, apiKey);
    }, [apiKey]);

    const handleFetch = () => {
        if (urlInput.trim()) {
            fetchRepo(urlInput.trim(), apiKey.trim());
        }
    };
    
    const handleStageFile = (path: string) => {
        stageFile(path, apiKey.trim());
    };
    
    const handleStageFolder = (path: string) => {
        stageFolder(path, apiKey.trim());
    };

    const handleStageAll = () => {
        if (fileTree) stageAllFiles(apiKey.trim());
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
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
                                <Label htmlFor="api-key">GitHub API Key (Optional)</Label>
                                <Input
                                    id="api-key"
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter personal access token for higher rate limits"
                                />
                            </div>
                            <Button onClick={handleFetch} disabled={isLoading} size="lg" className="w-full">
                                {isLoading ? 'Loading Repository...' : 'Load Repository'}
                            </Button>
                        </CardContent>
                    </Card>
                    <Card className="flex-1 flex flex-col overflow-hidden">
                         <CardHeader>
                            <div className="flex justify-between items-center">
                                <div className="space-y-1.5">
                                    <CardTitle>Staged Files for Context</CardTitle>
                                    <CardDescription>The content of these files will be sent to context-aware agents.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="outline" onClick={handleStageAll} disabled={!fileTree || stagedFiles.length === totalFiles} data-tooltip="Stage All Files">
                                        <FilesIcon className="w-5 h-5" />
                                    </Button>
                                     <Button size="icon" variant="outline" onClick={unstageAllFiles} disabled={stagedFiles.length === 0} data-tooltip="Unstage All Files">
                                        <FileMinusIcon className="w-5 h-5" />
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
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader>
                        <CardTitle>Repository Structure</CardTitle>
                        {repoUrl && <CardDescription className="font-mono text-primary/80">{repoUrl}</CardDescription>}
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
                        
                        {!isLoading && fileTree && <FileTree tree={fileTree} stagedFiles={stagedFiles} onStageFile={handleStageFile} onStageFolder={handleStageFolder} onUnstageFolder={unstageFolder} />}

                         {error && <p className="text-sm text-destructive mt-4 p-3 bg-destructive/10 rounded-md">{error}</p>}
                        
                        {!isLoading && !fileTree && !error && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center p-4 border-2 border-dashed rounded-lg">
                                    <GithubIcon className="w-12 h-12 mx-auto mb-2" />
                                    <p>Load a repository to see its file structure here.</p>
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