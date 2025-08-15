import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { githubService, FileNode } from '../services/github.service';

interface GithubContextType {
  repoUrl: string;
  fileTree: FileNode[] | null;
  isLoading: boolean;
  error: string | null;
  fetchRepo: (url: string, apiKey?: string) => Promise<void>;
}

export const GithubContext = createContext<GithubContextType>({
  repoUrl: '',
  fileTree: null,
  isLoading: false,
  error: null,
  fetchRepo: async () => {},
});

export const GithubProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [fileTree, setFileTree] = useState<FileNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRepo = useCallback(async (url: string, apiKey?: string) => {
    setIsLoading(true);
    setError(null);
    setFileTree(null);
    try {
      const tree = await githubService.fetchRepoTree(url, apiKey);
      setFileTree(tree);
      setRepoUrl(url);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch repository.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <GithubContext.Provider value={{ repoUrl, fileTree, isLoading, error, fetchRepo }}>
      {children}
    </GithubContext.Provider>
  );
};
