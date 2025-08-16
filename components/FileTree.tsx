import React from 'react';
import { FileNode, StagedFile } from '../services/github.service';
import { FileTreeNode } from './FileTreeNode';

interface FileTreeProps {
    tree: FileNode[];
    stagedFiles: StagedFile[];
    onStageFile: (path: string) => void;
    onStageFolder: (path: string) => void;
    onUnstageFolder: (path: string) => void;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ tree, ...props }) => {
    return (
        <div className="font-mono text-sm text-foreground/80">
            {tree.map(node => (
                <FileTreeNode
                    key={node.path}
                    node={node}
                    level={0}
                    {...props}
                />
            ))}
        </div>
    );
};