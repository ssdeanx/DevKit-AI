

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { DatabaseIcon, CloseIcon, PlusCircleIcon } from '../components/icons';
import ViewHeader from '../components/ViewHeader';
import { knowledgeService, IndexedSource } from '../services/knowledge.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { Input } from '../components/ui/Input';
import EmptyState from '../components/EmptyState';
import { useToast } from '../context/ToastContext';
import { historyService } from '../services/history.service';
import { supervisor } from '../services/supervisor';
import { MemoryConsolidationAgent } from '../agents/MemoryConsolidationAgent';
import { GithubContext } from '../context/GithubContext';

const KnowledgeSourceItem: React.FC<{ source: IndexedSource, onRemove: (id: string) => void }> = ({ source, onRemove }) => {
    return (
        <div className="group flex items-center justify-between bg-secondary/50 p-3 rounded-lg text-sm">
            <div className="flex flex-col truncate">
                <span className="font-semibold truncate" title={source.identifier}>{source.identifier}</span>
                <span className="text-xs capitalize text-muted-foreground">{source.type}</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0 opacity-50 group-hover:opacity-100" onClick={() => onRemove(source.identifier)}>
                <CloseIcon className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
            </Button>
        </div>
    );
};

const KnowledgeBaseView: React.FC = () => {
    const [sources, setSources] = useState<IndexedSource[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newTextSource, setNewTextSource] = useState({ identifier: '', content: '' });
    const { toast } = useToast();
    const { repoUrl } = useContext(GithubContext);

    const fetchSources = useCallback(async () => {
        setIsLoading(true);
        const fetchedSources = await knowledgeService.getAllDocuments();
        setSources(fetchedSources);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchSources();
    }, [fetchSources]);

    const handleRemoveSource = async (identifier: string) => {
        await knowledgeService.removeDocument(identifier);
        toast({ title: "Source Removed", description: `'${identifier}' has been removed from the knowledge base.` });
        fetchSources();
    };

    const handleAddTextSource = async () => {
        if (!newTextSource.identifier.trim() || !newTextSource.content.trim()) {
            toast({ title: "Error", description: "Please provide both a name and content for the text source.", variant: 'destructive' });
            return;
        }
        await knowledgeService.addDocument(newTextSource.identifier, 'text', newTextSource.content);
        toast({ title: "Source Added", description: `Text source '${newTextSource.identifier}' has been indexed.` });
        setNewTextSource({ identifier: '', content: '' });
        fetchSources();
    };
    
    const handleConsolidateChatHistory = async () => {
        const history = historyService.getHistory();
        if (history.length < 2) {
            toast({ title: "Not Enough History", description: "There is not enough conversation history to consolidate." });
            return;
        }
        
        toast({ title: "Consolidating...", description: "AI is summarizing the last chat session." });
        
        try {
            const conversation = history.map(entry => `[${entry.author}]: ${entry.content}`).join('\n\n');
            const prompt = `Please summarize the key takeaways from this conversation:\n\n${conversation}`;
            // FIX: Pass repoUrl to satisfy FullGitContext type
            const { stream } = await supervisor.handleRequest(prompt, { repoUrl, fileTree: null, stagedFiles: [] }, { setActiveView: () => {} }, MemoryConsolidationAgent.id);
            
            let summaryJson = '';
            for await (const chunk of stream) {
                if (chunk.type === 'content') summaryJson += chunk.content;
            }
            
            const result = JSON.parse(summaryJson.replace(/```json|```/g, '').trim());
            
            if (result.summary) {
                const identifier = `chat-summary-${new Date().toISOString()}`;
                await knowledgeService.addDocument(identifier, 'chat', result.summary);
                toast({ title: "Chat History Consolidated", description: "Key takeaways have been added to the knowledge base." });
                fetchSources();
            } else {
                 toast({ title: "No New Insights", description: "No significant new information was found to consolidate." });
            }
        } catch (e: any) {
             toast({ title: "Error", description: `Failed to consolidate history: ${e.message}`, variant: 'destructive' });
        }
    };
    
    const handleClearAll = async () => {
        if (window.confirm("Are you sure you want to clear the entire knowledge base? This will remove all indexed files and documents.")) {
            await knowledgeService.clear();
            toast({ title: "Knowledge Base Cleared", description: "All indexed sources have been removed.", variant: 'destructive' });
            fetchSources();
        }
    };

    return (
        <div className="flex flex-col h-full">
            <ViewHeader
                icon={<DatabaseIcon className="w-6 h-6" />}
                title="Knowledge Base (Semantic Memory)"
                description="Manage the AI's long-term, retrievable knowledge."
            />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-hidden">
                {/* Source Management Panel */}
                <div className="flex flex-col h-full gap-6">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Indexed Sources ({sources.length})</CardTitle>
                                <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={sources.length === 0}>Clear All</Button>
                            </div>
                            <CardDescription>Documents available for the AI's context via RAG.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? <p>Loading sources...</p> : sources.length > 0 ? (
                                <div className="space-y-3">
                                    {sources.map(source => <KnowledgeSourceItem key={source.identifier} source={source} onRemove={handleRemoveSource} />)}
                                </div>
                            ) : (
                                 <EmptyState icon={<DatabaseIcon className="w-10 h-10"/>} title="Knowledge Base is Empty" description="Stage files in the GitHub Inspector or add documents here to build the AI's knowledge."/>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Add Sources Panel */}
                <div className="flex flex-col h-full gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add New Knowledge</CardTitle>
                            <CardDescription>Manually add documents or process conversations.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Add Text Document</label>
                                <Input 
                                    placeholder="Document Name / Identifier"
                                    value={newTextSource.identifier}
                                    onChange={e => setNewTextSource(s => ({...s, identifier: e.target.value}))}
                                />
                                <Textarea 
                                    placeholder="Paste content here..."
                                    value={newTextSource.content}
                                    onChange={e => setNewTextSource(s => ({...s, content: e.target.value}))}
                                    className="min-h-[120px]"
                                />
                                <Button onClick={handleAddTextSource} className="w-full">
                                    <PlusCircleIcon className="w-4 h-4 mr-2"/>
                                    Add and Index Text
                                </Button>
                            </div>
                             <div className="space-y-2 border-t pt-4">
                                <label className="text-sm font-medium">Memory Processors</label>
                                <Button onClick={handleConsolidateChatHistory} variant="outline" className="w-full">Consolidate Last Chat Session</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBaseView;