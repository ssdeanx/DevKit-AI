import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { githubService, FileNode, StagedFile } from '../services/github.service';
import { knowledgeService, IndexedSource } from '../services/knowledge.service';
import { useToast } from './ToastContext';
import { cacheService } from '../services/cache.service';

const GITHUB_API_KEY_STORAGE_KEY = 'devkit-github-api-key';

const IGNORE_PATTERNS = [
    // Version control
    '.git/',
    // Dependencies
    'node_modules/',
    'bower_components/',
    // Build artifacts
    'dist/',
    'build/',
    'out/',
    '.next/',
    '.nuxt/',
    // Lock files
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    // Logs
    '*.log',
    // System files
    '.DS_Store',
    'Thumbs.db',
];

const isIgnored = (path: string) => {
    return IGNORE_PATTERNS.some(pattern => {
        if (pattern.endsWith('/')) {
            return path.includes(pattern);
        }
        if (pattern.startsWith('*.')) {
            return path.endsWith(pattern.substring(1));
        }
        return path.endsWith(pattern);
    });
};

interface IndexingStatus {
    total: number;
    completed: number;
    currentFile: string;
    chunksTotal: number;
    chunksCompleted: number;
}

interface GithubContextType {
  repoUrl: string;
  fileTree: FileNode[] | null;
  stagedFiles: StagedFile[];
  isLoading: boolean;
  error: string | null;
  apiKey: string;
  setApiKey: (key: string) => void;
  fetchRepo: (url: string) => Promise<void>;
  stageFile: (path: string) => void;
  unstageFile: (path: string) => void;
  stageFolder: (path: string) => void;
  unstageFolder: (path: string) => void;
  stageAllFiles: () => void;
  unstageAllFiles: () => void;
  getIndexedSources: () => Promise<IndexedSource[]>;
  indexingStatus: IndexingStatus;
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
  stageFile: () => {},
  unstageFile: () => {},
  stageFolder: () => {},
  unstageFolder: () => {},
  stageAllFiles: () => {},
  unstageAllFiles: () => {},
  getIndexedSources: async () => [],
  indexingStatus: { total: 0, completed: 0, currentFile: '', chunksTotal: 0, chunksCompleted: 0 },
});

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

const getFilePathsFromNode = (node: FileNode): string[] => {
    let paths: string[] = [];
    if (node.type === 'file') {
        if (!isIgnored(node.path)) {
            paths.push(node.path);
        }
    } else if (node.type === 'dir' && node.children) {
        if (!isIgnored(node.path + '/')) {
            node.children.forEach(child => {
                paths.push(...getFilePathsFromNode(child));
            });
        }
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

  const [indexingQueue, setIndexingQueue] = useState<string[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>({ total: 0, completed: 0, currentFile: '', chunksTotal: 0, chunksCompleted: 0 });
  const { toast } = useToast();

  useEffect(() => {
      localStorage.setItem(GITHUB_API_KEY_STORAGE_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    const processQueue = async () => {
        if (isIndexing || indexingQueue.length === 0) {
            if (!isIndexing && indexingQueue.length === 0 && indexingStatus.total > 0 && indexingStatus.completed === indexingStatus.total) {
                toast({ title: "Indexing Complete", description: `${indexingStatus.total} files are now available in the knowledge base.` });
                setTimeout(() => setIndexingStatus({ total: 0, completed: 0, currentFile: '', chunksTotal: 0, chunksCompleted: 0 }), 2000);
            }
            return;
        }

        setIsIndexing(true);
        const path = indexingQueue[0];
        setIndexingStatus(prev => ({ ...prev, currentFile: path, chunksTotal: 0, chunksCompleted: 0 }));
        
        try {
            const content = await githubService.fetchFileContent(repoUrl, path, apiKey);
            const newFile = { path, content };
            // Add to staged files for UI indicator, but knowledge service is the source of truth for RAG
            setStagedFiles(prev => [...prev.filter(f => f.path !== path), newFile]);
            
            const onProgress = (progress: { processed: number; total: number }) => {
                setIndexingStatus(prev => ({
                    ...prev,
                    chunksCompleted: progress.processed,
                    chunksTotal: progress.total
                }));
            };

            await knowledgeService.addDocument(path, 'code', content, onProgress);
        } catch (e: any) {
            const errorMessage = e.message || `Failed to fetch/index file: ${path}`;
            setError(errorMessage);
            toast({ title: 'Indexing Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setIndexingStatus(prev => ({ ...prev, completed: prev.completed + 1 }));
            setIndexingQueue(prev => prev.slice(1));
            setIsIndexing(false);
        }
    };
    processQueue();
  }, [indexingQueue, isIndexing, repoUrl, apiKey, indexingStatus.total, indexingStatus.completed, toast]);

  const fetchRepo = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setFileTree(null);
    setStagedFiles([]);
    await knowledgeService.clear();
    setIndexingQueue([]);
    setIndexingStatus({ total: 0, completed: 0, currentFile: '', chunksTotal: 0, chunksCompleted: 0 });
    try {
      const cacheKey = `repo-tree::${url}`;
      const cachedTree = await cacheService.get<FileNode[]>(cacheKey);
      if (cachedTree) {
          console.log("Loading repo tree from cache.");
          setFileTree(cachedTree);
          setRepoUrl(url);
      } else {
          const tree = await githubService.fetchRepoTree(url, apiKey);
          setFileTree(tree);
          setRepoUrl(url);
          await cacheService.set(cacheKey, tree, 10 * 60 * 1000); // 10 minute TTL
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch repository.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  const addToQueue = useCallback((paths: string[]) => {
      const newPaths = paths.filter(p => !stagedFiles.some(sf => sf.path === p) && !indexingQueue.includes(p));
      if (newPaths.length > 0) {
          setIndexingStatus(prev => ({ total: prev.total + newPaths.length, completed: prev.completed, currentFile: '', chunksTotal: 0, chunksCompleted: 0 }));
          setIndexingQueue(prev => [...prev, ...newPaths]);
      }
  }, [stagedFiles, indexingQueue]);

  const stageFile = useCallback((path: string) => {
    if (isIgnored(path)) {
        toast({ title: 'File Ignored', description: `File '${path}' matches an ignore pattern and was not staged.`});
        return;
    }
    addToQueue([path]);
  }, [addToQueue, toast]);

  const unstageFile = useCallback(async (path: string) => {
    setStagedFiles(prev => prev.filter(f => f.path !== path));
    await knowledgeService.removeDocument(path);
  }, []);

  const stageFolder = useCallback((path: string) => {
    if (!fileTree) return;
    const folderNode = findNodeByPath(fileTree, path);
    if (!folderNode || folderNode.type !== 'dir') return;
    const filePaths = getFilePathsFromNode(folderNode);
    addToQueue(filePaths);
  }, [fileTree, addToQueue]);

  const unstageFolder = useCallback(async (path: string) => {
    if (!fileTree) return;
    const folderNode = findNodeByPath(fileTree, path);
    if (!folderNode || folderNode.type !== 'dir') return;
    const filePathsInFolder = getFilePathsFromNode(folderNode);
    setStagedFiles(prev => prev.filter(sf => !filePathsInFolder.includes(sf.path)));
    await Promise.all(filePathsInFolder.map(p => knowledgeService.removeDocument(p)));
  }, [fileTree]);

  const stageAllFiles = useCallback(() => {
    if (!fileTree) return;
    const allFilePaths = getFilePathsFromNode({ name: 'root', path: '', type: 'dir', children: fileTree });
    addToQueue(allFilePaths);
  }, [fileTree, addToQueue]);
  
  const unstageAllFiles = useCallback(async () => {
    setStagedFiles([]);
    await knowledgeService.clear();
  }, []);
  
  const getIndexedSources = useCallback(async () => {
      return knowledgeService.getAllDocuments();
  }, []);

  return (
    <GithubContext.Provider value={{ repoUrl, fileTree, stagedFiles, isLoading, error, apiKey, setApiKey, fetchRepo, stageFile, unstageFile, stageFolder, unstageFolder, stageAllFiles, unstageAllFiles, getIndexedSources, indexingStatus }}>
      {children}
    </GithubContext.Provider>
  );
};