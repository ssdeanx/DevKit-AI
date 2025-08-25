
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

export interface StagedFile {
    path: string;
    content: string;
}

export interface PullRequestSummary {
    title: string;
    url: string;
    repo: string;
    number: number;
}

export interface RepoSearchResult {
    id: number;
    fullName: string;
    description: string;
    stars: number;
    url: string;
}

export interface CodeSearchResult {
    repo: string;
    path: string;
    url: string;
}

export interface IssueDetails {
    title: string;
    body: string;
    url: string;
    repo: string;
}

export interface RepoLabel {
    name: string;
    color: string;
    description: string | null;
}

class GithubService {
  private parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+)/);
    if (match && match[1] && match[2]) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  }

  private parsePullRequestUrl(url: string): { owner: string; repo: string; pull_number: string } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (match && match[1] && match[2] && match[3]) {
      return { owner: match[1], repo: match[2], pull_number: match[3] };
    }
    return null;
  }
  
  private parseIssueUrl(url: string): { owner: string; repo: string; issue_number: string } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (match && match[1] && match[2] && match[3]) {
      return { owner: match[1], repo: match[2], issue_number: match[3] };
    }
    return null;
  }


  private buildFileTree(files: { path: string; type: string }[]): FileNode[] {
    const fileTree: FileNode[] = [];
    const map = new Map<string, FileNode>();

    // Filter out submodule references ('commit' type) and sort by path length
    const sortedFiles = files
      .filter(file => file.type === 'blob' || file.type === 'tree')
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length);


    sortedFiles.forEach(file => {
      const parts = file.path.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');
      
      const node: FileNode = {
        name,
        path: file.path,
        type: file.type === 'tree' ? 'dir' : 'file',
      };
      if (node.type === 'dir') {
        node.children = [];
      }
      
      map.set(file.path, node);

      if (parentPath) {
        const parent = map.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else {
        fileTree.push(node);
      }
    });

    // Sort children alphabetically with directories first
    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.type === 'dir' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(node => {
        if (node.children) sortNodes(node.children);
      });
    };
    
    sortNodes(fileTree);
    // Use structuredClone for a deep copy to prevent any potential downstream mutations
    return structuredClone(fileTree);
  }

  async fetchRepoTree(url: string, apiKey?: string): Promise<FileNode[]> {
    const repoInfo = this.parseRepoUrl(url);
    if (!repoInfo) {
      throw new Error("Invalid GitHub URL. Use format: https://github.com/owner/repo");
    }

    const { owner, repo } = repoInfo;
    
    const headers: HeadersInit = { 'Accept': 'application/vnd.github.v3+json' };
    if (apiKey) {
      headers['Authorization'] = `token ${apiKey}`;
    }

    const repoDetailsUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoDetailsResponse = await fetch(repoDetailsUrl, { headers });
    
    if (!repoDetailsResponse.ok) {
        if (repoDetailsResponse.status === 401) {
            throw new Error("Authentication failed. Please check if your GitHub API Key is valid and has the correct permissions.");
        }
        if (repoDetailsResponse.status === 403 && repoDetailsResponse.headers.get('X-RateLimit-Remaining') === '0') {
             throw new Error("GitHub API rate limit exceeded. Please add a Personal Access Token to continue, or wait for the limit to reset.");
        }
        if (repoDetailsResponse.status === 404) {
            throw new Error(`Repository not found. Please check the URL.`);
        }
        throw new Error(`Failed to fetch repo details (Status: ${repoDetailsResponse.status}).`);
    }

    const repoData = await repoDetailsResponse.json();
    const mainBranch = repoData.default_branch;

    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${mainBranch}?recursive=1`;
    const treeResponse = await fetch(treeUrl, { headers });

    if (!treeResponse.ok) {
       if (treeResponse.status === 401) {
            throw new Error("Authentication failed. Please check if your GitHub API Key is valid and has the correct permissions.");
       }
       if (treeResponse.status === 403 && treeResponse.headers.get('X-RateLimit-Remaining') === '0') {
            throw new Error("GitHub API rate limit exceeded. Please add a Personal Access Token to continue.");
       }
      throw new Error(`Failed to fetch repository tree (Status: ${treeResponse.status}).`);
    }

    const data = await treeResponse.json();
    if (data.truncated) {
        console.warn("Repo tree is truncated as it contains too many files. Only a partial tree is shown.");
    }
    
    return this.buildFileTree(data.tree);
  }

  async fetchFileContent(repoUrl: string, path: string, apiKey?: string): Promise<string> {
    const repoInfo = this.parseRepoUrl(repoUrl);
    if (!repoInfo) {
      throw new Error("Invalid GitHub URL.");
    }
    const { owner, repo } = repoInfo;
    
    const headers: HeadersInit = { 'Accept': 'application/vnd.github.v3+json' };
    if (apiKey) {
        headers['Authorization'] = `token ${apiKey}`;
    }

    const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(fileUrl, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch file content for ${path} (Status: ${response.status})`);
    }

    const data = await response.json();
    if (data.encoding !== 'base64') {
        throw new Error(`Unsupported file encoding: ${data.encoding}`);
    }

    // Decode base64 content
    return atob(data.content);
  }

  async fetchPullRequestFiles(prUrl: string, apiKey?: string): Promise<StagedFile[]> {
    const prInfo = this.parsePullRequestUrl(prUrl);
    if (!prInfo) {
      throw new Error("Invalid GitHub Pull Request URL.");
    }
    const { owner, repo, pull_number } = prInfo;

    const headers: HeadersInit = { 'Accept': 'application/vnd.github.v3+json' };
    if (apiKey) {
      headers['Authorization'] = `token ${apiKey}`;
    }

    const filesUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/files`;
    const response = await fetch(filesUrl, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch PR file list (Status: ${response.status})`);
    }

    const filesData = await response.json();
    
    const changedFiles: StagedFile[] = [];
    
    // For simplicity, we fetch the full content of each changed file.
    // A more advanced implementation might use the 'patch' data to show diffs.
    for (const file of filesData) {
        if (file.status !== 'removed') { // We can't review removed files
            try {
                const content = await this.fetchFileContent(`https://github.com/${owner}/${repo}`, file.filename, apiKey);
                changedFiles.push({ path: file.filename, content });
            } catch (error) {
                console.warn(`Could not fetch content for ${file.filename}, skipping.`, error);
            }
        }
    }

    return changedFiles;
  }

  async fetchUserPullRequests(apiKey: string): Promise<PullRequestSummary[]> {
      if (!apiKey) {
        throw new Error("A GitHub API key is required to fetch your pull requests.");
      }
      
      const headers: HeadersInit = { 
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${apiKey}`
      };

      // 1. Get the authenticated user's login name
      const userResponse = await fetch('https://api.github.com/user', { headers });
      if (!userResponse.ok) {
          throw new Error('Failed to authenticate with the provided API key.');
      }
      const userData = await userResponse.json();
      const login = userData.login;

      // 2. Search for open PRs assigned to the user
      const searchUrl = `https://api.github.com/search/issues?q=is:pr+is:open+assignee:${login}`;
      const prResponse = await fetch(searchUrl, { headers });

      if (!prResponse.ok) {
          throw new Error(`Failed to fetch pull requests (Status: ${prResponse.status}).`);
      }
      
      const prData = await prResponse.json();

      return prData.items.map((pr: any) => ({
          title: pr.title,
          url: pr.html_url,
          number: pr.number,
          repo: pr.repository_url.split('/').slice(-2).join('/'),
      }));
  }

  async searchRepositories(query: string, apiKey: string): Promise<RepoSearchResult[]> {
      if (!apiKey) throw new Error("A GitHub API key is required for repository search.");
      const headers: HeadersInit = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${apiKey}` };
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`Failed to search repositories (Status: ${response.status})`);
      const data = await response.json();
      return data.items.map((item: any) => ({
        id: item.id,
        fullName: item.full_name,
        description: item.description,
        stars: item.stargazers_count,
        url: item.html_url,
      }));
  }

  async searchCode(query: string, apiKey: string): Promise<CodeSearchResult[]> {
    if (!apiKey) throw new Error("A GitHub API key is required for code search.");
    const headers: HeadersInit = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${apiKey}` };
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=5`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to search code (Status: ${response.status})`);
    const data = await response.json();
    return data.items.map((item: any) => ({
      repo: item.repository.full_name,
      path: item.path,
      url: item.html_url,
    }));
  }
  
  async fetchIssueDetails(issueUrl: string, apiKey: string): Promise<IssueDetails> {
    const issueInfo = this.parseIssueUrl(issueUrl);
    if (!issueInfo) throw new Error("Invalid GitHub Issue URL.");
    const { owner, repo, issue_number } = issueInfo;
    
    const headers: HeadersInit = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${apiKey}` };
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch issue details (Status: ${response.status})`);
    const data = await response.json();
    return { title: data.title, body: data.body, url: data.html_url, repo: `${owner}/${repo}` };
  }
  
  async fetchRepoLabels(repoFullName: string, apiKey: string): Promise<RepoLabel[]> {
    const headers: HeadersInit = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${apiKey}` };
    const url = `https://api.github.com/repos/${repoFullName}/labels`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch repo labels (Status: ${response.status})`);
    const data = await response.json();
    return data.map((label: any) => ({
        name: label.name,
        color: label.color,
        description: label.description
    }));
  }

  async setIssueLabels(issueUrl: string, labels: string[], apiKey: string): Promise<{ success: boolean }> {
      const issueInfo = this.parseIssueUrl(issueUrl);
      if (!issueInfo) throw new Error("Invalid GitHub Issue URL.");
      const { owner, repo, issue_number } = issueInfo;

      const headers: HeadersInit = { 
          'Accept': 'application/vnd.github.v3+json', 
          'Authorization': `token ${apiKey}`,
          'Content-Type': 'application/json'
      };
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}/labels`;
      const response = await fetch(url, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ labels })
      });

      if (!response.ok) throw new Error(`Failed to set issue labels (Status: ${response.status})`);
      return { success: true };
  }
}

export const githubService = new GithubService();