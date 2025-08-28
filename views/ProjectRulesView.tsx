

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
import GenerationInProgress from '../components/GenerationInProgress';

const ProjectRulesView: React.FC = () => {
  const [request, setRequest] = useState('');
  const { fileTree, repoUrl, stagedFiles, apiKey } = useContext(GithubContext);
  const { settings } = useSettings();

  const generateDocOperation = useStreamingOperation(async () => {
    if (!request.trim()) {
        throw new Error("Please provide a request for the specification.");
    }

    const cacheKey = `project-rules::${repoUrl}::${request}`;
    if (settings.isCacheEnabled) {
      const cachedDoc = await cacheService.get<string>(cacheKey);
      if (cachedDoc) {
        console.log(`ProjectRulesView: Loading doc from cache for key: ${cacheKey}`);
        const stream = async function*() {
            yield { type: 'content' as const, content: cachedDoc, agentName: ProjectRulesAgent.name };
        }();
        return { agent: ProjectRulesAgent, stream };
      }
    }

    console.log(`ProjectRulesView: Generating document for request: "${request}" (no cache)`);
    // FIX: Pass repoUrl to satisfy FullGitContext type
    return supervisor.handleRequest(request, { repoUrl, fileTree, stagedFiles, apiKey }, { setActiveView: () => {} }, ProjectRulesAgent.id);
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
    "Generate a technical specification document for the user authentication flow.",
    "Create a spec for the data models and schema based on the 'services' folder.",
    "Define the API contract for the endpoints exposed in the backend services.",
    "Generate coding standards for this project, including rules for component structure and state management."
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader
        icon={<DocumentIcon className="w-6 h-6" />}
        title="Specification Generator"
        description="Generate technical specifications and coding standards from your repository."
      />
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
        {/* Control Panel */}
        <div className="md:col-span-1 flex flex-col h-full gap-6">
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader>
                    <CardTitle>Specification Request</CardTitle>
                    <CardDescription>Describe the specification you want the AI to generate.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <RepoStatusIndicator />
                    <div className="overflow-y-auto custom-scrollbar pr-2 flex-1">
                        <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setRequest} />
                        <Textarea
                            value={request}
                            onChange={(e) => setRequest(e.target.value)}
                            placeholder="e.g., 'Generate a technical specification for the authentication flow based on the staged files.'"
                            className="h-48 resize-none"
                        />
                    </div>
                    <Button onClick={generateDocOperation.execute} disabled={generateDocOperation.isLoading || !repoUrl} size="lg" className="mt-auto">
                        {generateDocOperation.isLoading ? 'Generating...' : "Generate Specification"}
                    </Button>
                </CardContent>
            </Card>
        </div>
        
        {/* Canvas */}
        <div className="md:col-span-2 h-full flex flex-col relative canvas-background">
             <div className="flex justify-between items-center p-4 border-b border-border/50 relative z-10">
                 <h3 className="text-lg font-semibold">Generated Specification</h3>
                 {generateDocOperation.content && !generateDocOperation.isLoading && (
                    <Button onClick={handleCopy} variant="secondary">Copy</Button>
                 )}
            </div>
            
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
                {generateDocOperation.isLoading ? (
                    <GenerationInProgress agentName={generateDocOperation.agentName} thoughts={generateDocOperation.thoughts} />
                ) : generateDocOperation.content ? (
                    <MarkdownRenderer content={generateDocOperation.content} />
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <EmptyState
                            icon={<DocumentIcon className="w-12 h-12" />}
                            title="Ready to generate a specification?"
                            description='Describe the spec you need and click "Generate" to see the result here.'
                        />
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectRulesView;