import React, { useState, useEffect } from 'react';
import { knowledgeService, Fact } from '../services/knowledge.service';
import { DatabaseIcon, BrainIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import ViewHeader from '../components/ViewHeader';

const KnowledgeBaseView: React.FC = () => {
    const [facts, setFacts] = useState<Fact[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFacts = async () => {
            setIsLoading(true);
            const allFacts = await knowledgeService.getAllFacts();
            setFacts(allFacts.sort((a, b) => b.timestamp - a.timestamp));
            setIsLoading(false);
        };
        fetchFacts();
    }, []);

    const handleClearKnowledge = async () => {
        if (window.confirm("Are you sure you want to clear the AI's entire knowledge base? This action cannot be undone.")) {
            await knowledgeService.clearKnowledgeBase();
            setFacts([]);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <ViewHeader
                icon={<DatabaseIcon className="w-6 h-6" />}
                title="Knowledge Base"
                description="This is the AI's long-term memory. It stores key facts from research."
            >
                 {facts.length > 0 && (
                     <Button onClick={handleClearKnowledge} variant="destructive">
                        Clear Knowledge Base
                    </Button>
                )}
            </ViewHeader>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {isLoading ? (
                    <div className="text-center text-muted-foreground">Loading knowledge...</div>
                ) : facts.length === 0 ? (
                    <Card className="flex-1 flex items-center justify-center border-2 border-dashed border-border h-full min-h-[300px] bg-transparent shadow-none">
                        <CardContent className="text-center text-muted-foreground p-6">
                            <div className="mx-auto w-fit p-4 bg-secondary rounded-full mb-4">
                                <DatabaseIcon className="w-10 h-10" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">The Knowledge Base is Empty</h3>
                            <p>As you use the Research Agent, the AI will learn and store important facts here to improve its performance over time.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {facts.map(fact => (
                            <Card key={fact.id} className="animate-in card-interactive">
                                <CardContent className="p-4 flex items-start gap-4">
                                    <div className="p-2 bg-secondary rounded-full mt-1">
                                       <BrainIcon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm">{fact.content}</p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Learned from <span className="font-semibold">{fact.source}</span> on {new Date(fact.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgeBaseView;