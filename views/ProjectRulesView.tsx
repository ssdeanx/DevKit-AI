import React, { useState, useContext } from 'react';
import { supervisor } from '../services/supervisor';
import { GithubContext } from '../context/GithubContext';
import { ProjectRulesAgent } from '../agents/ProjectRulesAgent';
import { DocumentIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';

const ProjectRulesView: React.FC = () => {
  const [request, setRequest] = useState('Create a standard CONTRIBUTING.md file for a new open source project.');
  const [generatedDoc, setGeneratedDoc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { fileTree } = useContext(GithubContext);

  const handleGenerate = async () => {
    if (!request.trim()) return;
    setIsLoading(true);
    setGeneratedDoc('');
    try {
        const { stream } = await supervisor.handleRequest(request, fileTree, { setActiveView: () => {} }, ProjectRulesAgent.id);
        
        let content = '';
        for await (const chunk of stream) {
            if (chunk.type === 'content') {
                content += chunk.content;
                setGeneratedDoc(content);
            }
        }
    } catch (error) {
        console.error("Error generating project rules:", error);
        setGeneratedDoc("Sorry, an error occurred while generating the document.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDoc);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="p-6 border-b">
        <h1 className="text-2xl font-bold">Project Rules Generator</h1>
        <p className="text-sm text-muted-foreground">Generate contribution guidelines, codes of conduct, and more.</p>
      </header>
      
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
        <Card className="flex flex-col w-full md:w-1/3 h-full">
            <CardHeader>
                <CardTitle>Document Request</CardTitle>
                <CardDescription>What kind of document do you need?</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
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
          <CardContent className="flex-1 overflow-y-auto">
            {generatedDoc ? (
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">{generatedDoc}</pre>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <DocumentIcon className="w-12 h-12 mx-auto mb-2" />
                  <p>Your generated document will appear here.</p>
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