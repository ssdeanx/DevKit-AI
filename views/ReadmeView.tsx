
import React, { useState, useContext, useEffect } from 'react';
import { supervisor } from '../services/supervisor';
import { GithubContext } from '../context/GithubContext';
import { ReadmeAgent } from '../agents/ReadmeAgent';
import { DocumentIcon, SparklesIcon, BrainIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import ExamplePrompts from '../components/ExamplePrompts';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useSettings } from '../context/SettingsContext';
import ViewHeader from '../components/ViewHeader';
import { useStreamingOperation } from '../hooks/useStreamingOperation';
import EmptyState from '../components/EmptyState';
import RepoStatusIndicator from '../components/RepoStatusIndicator';
import { cacheService } from '../services/cache.service';

const ReadmeView: React.FC = () => {
  const [description, setDescription] = useState('');
  const { fileTree, repoUrl, stagedFiles } = useContext(GithubContext);
  const { settings } = useSettings();

  useEffect(() => {
    if (repoUrl && fileTree && description === '') {
      setDescription(`My project is located at the GitHub repo: ${repoUrl}. Please use the following file structure to inform the README content. Do not list the file structure in the README itself, but use it to understand the project's components and technologies.\n\nFile Structure:\n\`\`\`\n${JSON.stringify(fileTree, null, 2)}\n\`\`\``);
    } else if (!repoUrl) {
      setDescription('');
    }
  }, [repoUrl, fileTree, description]);

  const generateReadmeOperation = useStreamingOperation(async () => {
    if (!description.trim()) {
      throw new Error("Please provide a project description.");
    }
    
    const cacheKey = `readme::${repoUrl}::${description}`;
    if (settings.isCacheEnabled) {
        const cached = await cacheService.get<string>(cacheKey);
        if (cached) {
            console.log("ReadmeView: Using cached version.");
            // Create a fake stream for cached content
            const stream = async function*() {
                yield { type: 'content' as const, content: cached };
            }();
            return { agent: ReadmeAgent, stream };
        }
    }

    const prompt = `Generate a README for a project with the following description and context: ${description}`;
    console.log(`ReadmeView: Generating README with prompt: "${prompt}" (no cache)`);
    return supervisor.handleRequest(prompt, { fileTree, stagedFiles }, { setActiveView: () => {} }, ReadmeAgent.id);
  });
  
  // Cache the result after a successful operation
  useEffect(() => {
      if (!generateReadmeOperation.isLoading && generateReadmeOperation.content && settings.isCacheEnabled && repoUrl) {
          const cacheKey = `readme::${repoUrl}::${description}`;
          cacheService.set(cacheKey, generateReadmeOperation.content);
      }
  }, [generateReadmeOperation.isLoading, generateReadmeOperation.content, settings.isCacheEnabled, repoUrl, description]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReadmeOperation.content);
  };
  
  const examplePrompts = [
    "Generate a README for a CLI tool written in Go that processes CSV files.",
    "Create a professional README for a React component library published on NPM.",
    "Draft a README for a backend service built with Node.js, Express, and PostgreSQL.",
    "Generate a README for an open-source data visualization project using D3.js."
  ];

  return (
    <div className="flex flex-col h-full">
      <ViewHeader
        icon={<DocumentIcon className="w-6 h-6" />}
        title="README Pro Generator"
        description="Create professional README files for your projects instantly."
      />
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
        {/* Control Panel */}
        <div className="md:col-span-1 flex flex-col h-full gap-6">
             <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader>
                    <CardTitle>Control Panel</CardTitle>
                    <CardDescription>Provide a description and context for your project.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <RepoStatusIndicator />
                    <div className="overflow-y-auto custom-scrollbar pr-2 flex-1">
                        <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setDescription} />
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe your project, its purpose, main technologies used, etc. If a GitHub repo is loaded, its structure will be included automatically."
                            className="h-48 resize-none font-mono text-sm"
                        />
                    </div>
                    <Button
                        onClick={generateReadmeOperation.execute}
                        disabled={generateReadmeOperation.isLoading || !repoUrl}
                        size="lg"
                        className="mt-auto"
                    >
                        {generateReadmeOperation.isLoading ? 'Generating...' : "Generate README"}
                    </Button>
                </CardContent>
            </Card>
            {generateReadmeOperation.thoughts && (
                <Card className="bg-muted/50 animate-in fade-in">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><BrainIcon className="w-4 h-4"/> Agent Thoughts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{generateReadmeOperation.thoughts}</p>
                    </CardContent>
                </Card>
            )}
        </div>

        {/* Canvas */}
        <div className="md:col-span-2 h-full flex flex-col relative aurora-canvas canvas-background">
             <div className="flex justify-between items-center p-4 border-b border-border/50 relative z-10">
                 <h3 className="text-lg font-semibold">Generated README.md</h3>
                 {generateReadmeOperation.content && !generateReadmeOperation.isLoading && (
                    <Button onClick={handleCopy} variant="secondary">Copy</Button>
                 )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
                {!generateReadmeOperation.content && !generateReadmeOperation.isLoading && (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                        icon={<DocumentIcon className="w-12 h-12" />}
                        title="Your README awaits"
                        description='Describe your project and click "Generate" to see the result here.'
                    />
                  </div>
                )}
                
                {generateReadmeOperation.content && (
                    <MarkdownRenderer content={generateReadmeOperation.content} />
                )}
            </div>
            
            {generateReadmeOperation.isLoading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
                    <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold mt-4">Generating Document...</h3>
                    <p className="text-muted-foreground mt-1">The `ReadmeAgent` is crafting your file.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ReadmeView;
