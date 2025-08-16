
import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { githubService, FileNode, StagedFile } from '../services/github.service';

const GITHUB_API_KEY_STORAGE_KEY = 'devkit-github-api-key';

interface GithubContextType {
  repoUrl: string;
  fileTree: FileNode[] | null;
  stagedFiles: StagedFile[];
  isLoading: boolean;
  error: string | null;
  apiKey: string;
  setApiKey: (key: string) => void;
  fetchRepo: (url: string) => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => void;
  stageFolder: (path: string) => Promise<void>;
  unstageFolder: (path: string) => void;
  stageAllFiles: () => Promise<void>;
  unstageAllFiles: () => void;
}

export const GithubContext = createContext<GithubContextType>({
  repoUrl: '',
  fileTree: null,
  stagedFiles: [],
  isLoading: false,
  error: null,
  apiKey: '',
  setApiKey: () => {},
  fetchRepo: async () => {},
  stageFile: async () => {},
  unstageFile: () => {},
  stageFolder: async () => {},
  unstageFolder: () => {},
  stageAllFiles: async () => {},
  unstageAllFiles: () => {},
});

// Helper to find a node in the tree by path
const findNodeByPath = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
            const found = findNodeByPath(node.children, path);
            if (found) return found;
        }
    }
    return null;
};

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


export const GithubProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [fileTree, setFileTree] = useState<FileNode[] | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GITHUB_API_KEY_STORAGE_KEY) || '');

  useEffect(() => {
      localStorage.setItem(GITHUB_API_KEY_STORAGE_KEY, apiKey);
  }, [apiKey]);

  const fetchRepo = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setFileTree(null);
    setStagedFiles([]); // Clear staged files when loading a new repo
    try {
      const tree = await githubService.fetchRepoTree(url, apiKey);
      setFileTree(tree);
      setRepoUrl(url);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch repository.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  const stageFile = useCallback(async (path: string) => {
    if (stagedFiles.some(f => f.path === path)) return; // Already staged
    setError(null);
    try {
        const content = await githubService.fetchFileContent(repoUrl, path, apiKey);
        setStagedFiles(prev => [...prev, { path, content }]);
    } catch (e: any) {
        setError(e.message || `Failed to fetch file: ${path}`);
    }
  }, [repoUrl, stagedFiles, apiKey]);

  const unstageFile = useCallback((path: string) => {
    setStagedFiles(prev => prev.filter(f => f.path !== path));
  }, []);

  const stageFolder = useCallback(async (path: string) => {
    if (!fileTree || !repoUrl) return;
    const folderNode = findNodeByPath(fileTree, path);
    if (!folderNode || folderNode.type !== 'dir') return;

    const filePaths = getFilePathsFromNode(folderNode);
    const unstagedFilePaths = filePaths.filter(p => !stagedFiles.some(sf => sf.path === p));
    
    if (unstagedFilePaths.length === 0) return;

    setError(null);
    const newFiles: StagedFile[] = [];
    try {
        const fetchedContents = await Promise.all(
            unstagedFilePaths.map(filePath => githubService.fetchFileContent(repoUrl, filePath, apiKey))
        );
        unstagedFilePaths.forEach((filePath, index) => {
            newFiles.push({ path: filePath, content: fetchedContents[index] });
        });
        setStagedFiles(prev => [...prev, ...newFiles]);
    } catch (e: any) {
        setError(e.message || `Failed to fetch some files in ${path}`);
    }
  }, [fileTree, repoUrl, stagedFiles, apiKey]);

  const unstageFolder = useCallback((path: string) => {
    if (!fileTree) return;
    const folderNode = findNodeByPath(fileTree, path);
    if (!folderNode || folderNode.type !== 'dir') return;

    const filePathsInFolder = getFilePathsFromNode(folderNode);
    setStagedFiles(prev => prev.filter(sf => !filePathsInFolder.includes(sf.path)));
  }, [fileTree]);

  const stageAllFiles = useCallback(async () => {
    if (!fileTree || !repoUrl) return;

    const allFilePaths: string[] = [];
    const traverse = (nodes: FileNode[]) => {
        for (const node of nodes) {
            if (node.type === 'file') {
                allFilePaths.push(node.path);
            } else if (node.children) {
                traverse(node.children);
            }
        }
    };
    traverse(fileTree);
    
    setError(null);
    try {
        const newFiles = await Promise.all(
            allFilePaths.map(async (path) => ({
                path,
                content: await githubService.fetchFileContent(repoUrl, path, apiKey)
            }))
        );
        setStagedFiles(newFiles);
    } catch (e: any) {
        setError(e.message || "Failed to stage all files.");
    }
  }, [fileTree, repoUrl, apiKey]);
  
  const unstageAllFiles = useCallback(() => {
    setStagedFiles([]);
  }, []);


  return (
    <GithubContext.Provider value={{ repoUrl, fileTree, stagedFiles, isLoading, error, apiKey, setApiKey, fetchRepo, stageFile, unstageFile, stageFolder, unstageFolder, stageAllFiles, unstageAllFiles }}>
      {children}
    </GithubContext.Provider>
  );
};
