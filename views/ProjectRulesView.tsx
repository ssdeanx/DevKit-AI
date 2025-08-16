import React, { useState, useContext } from 'react';
import { supervisor } from '../services/supervisor';
import { GithubContext } from '../context/GithubContext';
import { ProjectRulesAgent } from '../agents/ProjectRulesAgent';
import { DocumentIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import ExamplePrompts from '../components/ExamplePrompts';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { cacheService } from '../services/cache.service';
import { useSettings } from '../context/SettingsContext';
import ViewHeader from '../components/ViewHeader';

const ProjectRulesView: React.FC = () => {
  const [request, setRequest] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { fileTree, repoUrl, stagedFiles } = useContext(GithubContext);
  const { settings } = useSettings();

  const handleGenerate = async () => {
    if (!request.trim()) return;

    const cacheKey = `project-rules::${repoUrl}::${request}`;
    if (settings.isCacheEnabled) {
        const hasCache = await cacheService.has(cacheKey);
        if (hasCache) {
            console.log(`ProjectRulesView: Loading doc from cache for key: ${cacheKey}`);
            const cachedDoc = await cacheService.get<string>(cacheKey);
            if (cachedDoc) {
                setGeneratedDoc(cachedDoc);
                return;
            }
        }
    }

    setIsLoading(true);
    setGeneratedDoc('');
    try {
        console.log(`ProjectRulesView: Generating document for request: "${request}" (no cache)`);
        const { stream } = await supervisor.handleRequest(request, { fileTree, stagedFiles }, { setActiveView: () => {} }, ProjectRulesAgent.id);
        
        let content = '';
        for await (const chunk of stream) {
            if (chunk.type === 'content') {
                content += chunk.content;
                setGeneratedDoc(content);
            }
        }

        if (settings.isCacheEnabled) {
          console.log(`ProjectRulesView: Saving doc to cache with key: ${cacheKey}`);
          await cacheService.set(cacheKey, content);
        }
    } catch (error) {
        console.error("ProjectRulesView: Error generating project rules:", error);
        setGeneratedDoc("Sorry, an error occurred while generating the document.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDoc);
  };

  const examplePrompts = [
    "A standard Code of Conduct based on the Contributor Covenant.",
    "Contribution guidelines for a JavaScript project using Prettier and ESLint.",
    "A security policy (SECURITY.md) explaining how to report vulnerabilities.",
    "A simple governance model for a small open-source project."
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader
        icon={<DocumentIcon className="w-6 h-6" />}
        title="Project Rules Generator"
        description="Generate contribution guidelines, codes of conduct, and more."
      />
      
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
        <Card className="flex flex-col w-full md:w-1/3 h-full">
            <CardHeader>
                <CardTitle>Document Request</CardTitle>
                <CardDescription>What kind of document do you need?</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                 <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setRequest} />
                <Textarea
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder="e.g., 'Create a code of conduct based on the Contributor Covenant.'"
                    className="flex-1 resize-none"
                />
                <Button onClick={handleGenerate} disabled={isLoading} size="lg">
                    {isLoading ? 'Generating...' : "Generate Document"}
                </Button>
            </CardContent>
        </Card>

        <Card className="flex flex-col w-full md:w-2/3 h-full">
           <CardHeader className="flex-row justify-between items-center">
             <CardTitle>Generated Document</CardTitle>
             {generatedDoc && <Button onClick={handleCopy} variant="secondary">Copy</Button>}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
            {generatedDoc ? (
              <MarkdownRenderer content={generatedDoc} />
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center p-6 border-2 border-dashed rounded-lg">
                        <DocumentIcon className="w-12 h-12 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground">Ready to build your community?</h3>
                        <p>Request a document to see the generated content appear here.</p>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectRulesView;