
import React, { useState, useContext, useEffect } from 'react';
import { supervisor } from '../services/supervisor';
import { GithubContext } from '../context/GithubContext';
import { ProjectRulesAgent } from '../agents/ProjectRulesAgent';
import { DocumentIcon, SparklesIcon, BrainIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import ExamplePrompts from '../components/ExamplePrompts';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { cacheService } from '../services/cache.service';
import { useSettings } from '../context/SettingsContext';
import ViewHeader from '../components/ViewHeader';
import RepoStatusIndicator from '../components/RepoStatusIndicator';
import EmptyState from '../components/EmptyState';
import { useStreamingOperation } from '../hooks/useStreamingOperation';

const ProjectRulesView: React.FC = () => {
  const [request, setRequest] = useState('');
  const { fileTree, repoUrl, stagedFiles } = useContext(GithubContext);
  const { settings } = useSettings();

  const generateDocOperation = useStreamingOperation(async () => {
    if (!request.trim()) {
        throw new Error("Please provide a request for the constitution.");
    }

    const cacheKey = `project-rules::${repoUrl}::${request}`;
    if (settings.isCacheEnabled) {
      const cachedDoc = await cacheService.get<string>(cacheKey);
      if (cachedDoc) {
        console.log(`ProjectRulesView: Loading doc from cache for key: ${cacheKey}`);
        const stream = async function*() {
            yield { type: 'content' as const, content: cachedDoc };
        }();
        return { agent: ProjectRulesAgent, stream };
      }
    }

    console.log(`ProjectRulesView: Generating document for request: "${request}" (no cache)`);
    return supervisor.handleRequest(request, { fileTree, stagedFiles }, { setActiveView: () => {} }, ProjectRulesAgent.id);
  });
  
  // Cache the result after a successful operation
  useEffect(() => {
    if (!generateDocOperation.isLoading && generateDocOperation.content && settings.isCacheEnabled && repoUrl) {
      const cacheKey = `project-rules::${repoUrl}::${request}`;
      cacheService.set(cacheKey, generateDocOperation.content);
    }
  }, [generateDocOperation.isLoading, generateDocOperation.content, settings.isCacheEnabled, repoUrl, request]);


  const handleCopy = () => {
    navigator.clipboard.writeText(generateDocOperation.content);
  };

  const examplePrompts = [
    "Generate coding standards for a TypeScript/React project, including rules for component structure and state management.",
    "Create a style guide for Python code, specifying docstring formats and naming conventions.",
    "Define API design principles for a RESTful service, covering endpoint naming, versioning, and error handling.",
    "Generate a 'how-to' guide for debugging this application, based on the loaded source code."
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader
        icon={<DocumentIcon className="w-6 h-6" />}
        title="AI Project Constitution"
        description="Define coding standards and architectural rules for AI agents."
      />
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
        {/* Control Panel */}
        <div className="md:col-span-1 flex flex-col h-full gap-6">
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader>
                    <CardTitle>Constitution Request</CardTitle>
                    <CardDescription>What standards should the AI follow for this project?</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <RepoStatusIndicator />
                    <div className="overflow-y-auto custom-scrollbar pr-2 flex-1">
                        <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setRequest} />
                        <Textarea
                            value={request}
                            onChange={(e) => setRequest(e.target.value)}
                            placeholder="e.g., 'Generate coding standards for this Python project, focusing on naming conventions and error handling.'"
                            className="h-48 resize-none"
                        />
                    </div>
                    <Button onClick={generateDocOperation.execute} disabled={generateDocOperation.isLoading || !repoUrl} size="lg" className="mt-auto">
                        {generateDocOperation.isLoading ? 'Generating...' : "Generate Document"}
                    </Button>
                </CardContent>
            </Card>
            {generateDocOperation.thoughts && (
                <Card className="bg-muted/50 animate-in fade-in">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><BrainIcon className="w-4 h-4"/> Agent Thoughts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{generateDocOperation.thoughts}</p>
                    </CardContent>
                </Card>
            )}
        </div>
        
        {/* Canvas */}
        <div className="md:col-span-2 h-full flex flex-col relative aurora-canvas canvas-background">
             <div className="flex justify-between items-center p-4 border-b border-border/50 relative z-10">
                 <h3 className="text-lg font-semibold">Generated Document</h3>
                 {generateDocOperation.content && !generateDocOperation.isLoading && (
                    <Button onClick={handleCopy} variant="secondary">Copy</Button>
                 )}
            </div>
            
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
                {!generateDocOperation.content && !generateDocOperation.isLoading && (
                    <div className="h-full flex items-center justify-center">
                        <EmptyState
                            icon={<DocumentIcon className="w-12 h-12" />}
                            title="Ready to build your AI constitution?"
                            description='Request a document to see the generated content appear here.'
                        />
                    </div>
                )}
                {generateDocOperation.content && (
                    <MarkdownRenderer content={generateDocOperation.content} />
                )}
            </div>
            
            {generateDocOperation.isLoading && (
                 <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
                    <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold mt-4">Generating Constitution...</h3>
                    <p className="text-muted-foreground mt-1">The `ProjectRulesAgent` is analyzing your codebase.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProjectRulesView;
