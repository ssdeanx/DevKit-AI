import React, { useState, useContext, useEffect } from 'react';
import { supervisor } from '../services/supervisor';
import { GithubContext } from '../context/GithubContext';
import { ReadmeAgent } from '../agents/ReadmeAgent';
import { DocumentIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';

const ReadmeView: React.FC = () => {
  const [description, setDescription] = useState('');
  const [generatedReadme, setGeneratedReadme] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { fileTree, repoUrl } = useContext(GithubContext);

  useEffect(() => {
    if (repoUrl && fileTree) {
      setDescription(`My project is located at the GitHub repo: ${repoUrl}. Please use the following file structure to inform the README content. Do not list the file structure in the README itself, but use it to understand the project's components and technologies.\n\nFile Structure:\n\`\`\`\n${JSON.stringify(fileTree, null, 2)}\n\`\`\``);
    } else {
      setDescription('');
    }
  }, [repoUrl, fileTree]);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsLoading(true);
    setGeneratedReadme('');
    try {
        const prompt = `Generate a README for a project with the following description and context: ${description}`;
        const { stream } = await supervisor.handleRequest(prompt, fileTree, { setActiveView: () => {} }, ReadmeAgent.id);
        
        let content = '';
        for await (const chunk of stream) {
            if (chunk.type === 'content') {
                content += chunk.content;
                setGeneratedReadme(content);
            }
        }
    } catch (error) {
        console.error("Error generating README:", error);
        setGeneratedReadme("Sorry, an error occurred while generating the README.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedReadme);
  };

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
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">{generatedReadme}</pre>
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