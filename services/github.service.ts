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

class GithubService {
  private parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+)/);
    if (match && match[1] && match[2]) {
      return { owner: match[1], repo: match[2] };
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
    return fileTree;
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
}

export const githubService = new GithubService();