import React, { useState, useEffect } from 'react';
import { FileNode, StagedFile } from '../services/github.service';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { ChevronRightIcon, PlusCircleIcon, XCircleIcon, CheckCircleIcon, DatabaseIcon } from './icons';

// Helper function to get all file paths from a directory node
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


interface FileTreeNodeProps {
    node: FileNode;
    level: number;
    stagedFiles: StagedFile[];
    indexedFiles: Set<string>;
    onStageFile: (path: string) => void;
    onStageFolder: (path: string) => void;
    onUnstageFolder: (path: string) => void;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = React.memo(({
    node,
    level,
    stagedFiles,
    indexedFiles,
    onStageFile,
    onStageFolder,
    onUnstageFolder,
    expandedFolders,
    onToggleFolder,
}) => {
    const isExpanded = expandedFolders.has(node.path);
    const indent = level * 20;

    if (node.type === 'dir') {
        const status = getFolderStagingStatus(node, stagedFiles);
        let ActionIcon: React.FC<any> | null = null;
        let action: (() => void) | null = null;
        let tooltip: string | undefined = undefined;

        if (status === 'full') {
            ActionIcon = XCircleIcon;
            action = () => onUnstageFolder(node.path);
            tooltip = "Unstage all files in folder";
        } else if (status === 'none' || status === 'partial') {
            ActionIcon = PlusCircleIcon;
            action = () => onStageFolder(node.path);
            tooltip = status === 'none' ? "Stage all files in folder" : "Stage remaining files";
        }

        return (
            <div key={node.path}>
                <div
                    className="group file-tree-node"
                    style={{ paddingLeft: `${indent}px` }}
                    onClick={() => onToggleFolder(node.path)}
                >
                    <ChevronRightIcon className={cn('chevron-icon mr-1 h-4 w-4 flex-shrink-0', isExpanded && 'chevron-open')} />
                    <span className="mr-2">📁</span>
                    <span className="flex-1 truncate" title={node.name}>{node.name}</span>
                    {ActionIcon && action && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); action && action(); }}
                            data-tooltip={tooltip}
                        >
                            <ActionIcon className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>
                {isExpanded && node.children && node.children.map(child => (
                    <FileTreeNode
                        key={child.path}
                        node={child}
                        level={level + 1}
                        stagedFiles={stagedFiles}
                        indexedFiles={indexedFiles}
                        onStageFile={onStageFile}
                        onStageFolder={onStageFolder}
                        onUnstageFolder={onUnstageFolder}
                        expandedFolders={expandedFolders}
                        onToggleFolder={onToggleFolder}
                    />
                ))}
            </div>
        );
    }

    const isStaged = stagedFiles.some(f => f.path === node.path);
    const isIndexed = indexedFiles.has(node.path);

    return (
        <div key={node.path}
            className="group file-tree-node"
            style={{ paddingLeft: `${indent + 12}px` }}
        >
            <span className="mr-2">📄</span>
            <span className="flex-1 truncate" title={node.name}>{node.name}</span>
            <div className="flex items-center flex-shrink-0">
                {isStaged && (
                    <div data-tooltip={isIndexed ? "File is indexed in vector cache" : "Indexing file for context..."}>
                        <DatabaseIcon className={cn("w-4 h-4", isIndexed ? "text-success" : "text-muted-foreground animate-pulse")} />
                    </div>
                )}
                {!isStaged && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); onStageFile(node.path); }}
                        data-tooltip="Stage file for context"
                    >
                        <PlusCircleIcon className="w-4 h-4 text-muted-foreground" />
                    </Button>
                )}
            </div>
        </div>
    );
});