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

const ReadmeView: React.FC = () => {
  const [description, setDescription] = useState('');
  const [generatedReadme, setGeneratedReadme] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { fileTree, repoUrl } = useContext(GithubContext);
  const { settings } = useSettings();

  useEffect(() => {
    if (repoUrl && fileTree && description === '') {
      setDescription(`My project is located at the GitHub repo: ${repoUrl}. Please use the following file structure to inform the README content. Do not list the file structure in the README itself, but use it to understand the project's components and technologies.\n\nFile Structure:\n\`\`\`\n${JSON.stringify(fileTree, null, 2)}\n\`\`\``);
    } else if (!repoUrl) {
      setDescription('');
    }
  }, [repoUrl, fileTree, description]);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    
    const cacheKey = `readme::${repoUrl}::${description}`;
    if (settings.isCacheEnabled) {
      const hasCache = await cacheService.has(cacheKey);
      if (hasCache) {
        console.log(`ReadmeView: Loading README from cache for key: ${cacheKey}`);
        const cachedReadme = await cacheService.get<string>(cacheKey);
        if (cachedReadme) {
          setGeneratedReadme(cachedReadme);
          return;
        }
      }
    }

    setIsLoading(true);
    setGeneratedReadme('');
    try {
        const prompt = `Generate a README for a project with the following description and context: ${description}`;
        console.log(`ReadmeView: Generating README with prompt: "${prompt}" (no cache)`);
        const { stream } = await supervisor.handleRequest(prompt, fileTree, { setActiveView: () => {} }, ReadmeAgent.id);
        
        let content = '';
        for await (const chunk of stream) {
            if (chunk.type === 'content') {
                content += chunk.content;
                setGeneratedReadme(content);
            }
        }
        if (settings.isCacheEnabled) {
          console.log(`ReadmeView: Saving README to cache with key: ${cacheKey}`);
          await cacheService.set(cacheKey, content);
        }
    } catch (error) {
        console.error("ReadmeView: Error generating README:", error);
        setGeneratedReadme("Sorry, an error occurred while generating the README.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedReadme);
  };
  
  const examplePrompts = [
    "A personal portfolio website built with React and Three.js.",
    "A Python script that automates daily data backups to an S3 bucket.",
    "A mobile app for tracking personal fitness goals, built with Flutter.",
    "A Discord bot for community management written in Node.js."
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="p-6 border-b">
        <h1 className="text-2xl font-bold">README Pro Generator</h1>
        <p className="text-sm text-muted-foreground">Create professional README files for your projects instantly.</p>
      </header>
      
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
        <Card className="flex flex-col w-full md:w-1/3 h-full">
            <CardHeader>
                <CardTitle>Project Details</CardTitle>
                <CardDescription>Provide a description and context for your project.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
                <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setDescription} />
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your project, its purpose, main technologies used, etc. If a GitHub repo is loaded, its structure will be included automatically."
                    className="flex-1 resize-none font-mono text-sm"
                />
                <Button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    size="lg"
                >
                    {isLoading ? 'Generating...' : "Generate README"}
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
          <CardContent className="flex-1 overflow-y-auto">
            {generatedReadme ? (
              <MarkdownRenderer content={generatedReadme} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <DocumentIcon className="w-12 h-12 mx-auto mb-2" />
                  <p>Your generated README will appear here.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReadmeView;