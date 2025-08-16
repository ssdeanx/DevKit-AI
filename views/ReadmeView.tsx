

import React, { useState, useContext, useEffect } from 'react';
import { supervisor } from '../services/supervisor';
import { GithubContext } from '../context/GithubContext';
import { ReadmeAgent } from '../agents/ReadmeAgent';
import { DocumentIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import ExamplePrompts from '../components/ExamplePrompts';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { cacheService } from '../services/cache.service';
import { useSettings } from '../context/SettingsContext';
import ViewHeader from '../components/ViewHeader';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import EmptyState from '../components/EmptyState';
import RepoStatusIndicator from '../components/RepoStatusIndicator';

const ReadmeView: React.FC = () => {
  const [description, setDescription] = useState('');
  const [generatedReadme, setGeneratedReadme] = useState('');
  const { fileTree, repoUrl, stagedFiles } = useContext(GithubContext);
  const { settings } = useSettings();

  useEffect(() => {
    if (repoUrl && fileTree && description === '') {
      setDescription(`My project is located at the GitHub repo: ${repoUrl}. Please use the following file structure to inform the README content. Do not list the file structure in the README itself, but use it to understand the project's components and technologies.\n\nFile Structure:\n\`\`\`\n${JSON.stringify(fileTree, null, 2)}\n\`\`\``);
    } else if (!repoUrl) {
      setDescription('');
    }
  }, [repoUrl, fileTree, description]);

  const generateReadmeOperation = useAsyncOperation(async () => {
    if (!description.trim()) return;

    const cacheKey = `readme::${repoUrl}::${description}`;
    if (settings.isCacheEnabled) {
      const cachedReadme = await cacheService.get<string>(cacheKey);
      if (cachedReadme) {
        console.log(`ReadmeView: Loading README from cache for key: ${cacheKey}`);
        setGeneratedReadme(cachedReadme);
        return cachedReadme;
      }
    }

    setGeneratedReadme('');
    const prompt = `Generate a README for a project with the following description and context: ${description}`;
    console.log(`ReadmeView: Generating README with prompt: "${prompt}" (no cache)`);
    const { stream } = await supervisor.handleRequest(prompt, { fileTree, stagedFiles }, { setActiveView: () => {} }, ReadmeAgent.id);
    
    let content = '';
    for await (const chunk of stream) {
        if (chunk.type === 'content') {
            content += chunk.content;
            setGeneratedReadme(content); // Stream to UI
        }
    }

    if (settings.isCacheEnabled) {
      console.log(`ReadmeView: Saving README to cache with key: ${cacheKey}`);
      await cacheService.set(cacheKey, content);
    }
    return content;
  }, {
      onError: (e) => {
        console.error("ReadmeView: Error generating README:", e);
        setGeneratedReadme("Sorry, an error occurred while generating the README.");
      }
  });
  
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedReadme);
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
      
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
        <Card className="flex flex-col w-full md:w-1/3 h-full">
            <CardHeader>
                <CardTitle>Project Details</CardTitle>
                <CardDescription>Provide a description and context for your project.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <RepoStatusIndicator className="mb-2" />
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

        <Card className="flex flex-col w-full md:w-2/3 h-full">
           <CardHeader className="flex-row justify-between items-center">
             <div>
                <CardTitle>Generated README.md</CardTitle>
             </div>
             {generatedReadme && <Button onClick={handleCopy} variant="secondary">Copy</Button>}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
            {generatedReadme ? (
              <MarkdownRenderer content={generatedReadme} />
            ) : (
              <EmptyState
                icon={<DocumentIcon className="w-12 h-12" />}
                title="Your README awaits"
                description='Describe your project and click "Generate" to see the result here.'
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReadmeView;