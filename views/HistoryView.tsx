import React, { useState, useEffect } from 'react';
import { historyService, HistoryEntry } from '../services/history.service';
import { UserIcon, BotIcon, HistoryIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { cn } from '../lib/utils';
import ViewHeader from '../components/ViewHeader';

const HistoryView: React.FC = () => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        setHistory(historyService.getHistory());
    }, []);

    const handleClearHistory = () => {
        historyService.clearHistory();
        setHistory([]);
    };

    const HistoryItem: React.FC<{ entry: HistoryEntry }> = ({ entry }) => {
        const isUser = entry.author === 'user';
        return (
            <div className={cn("flex items-start gap-4", isUser ? "flex-row-reverse" : "")}>
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center mt-1">
                    {isUser ? <UserIcon className="w-6 h-6 text-secondary-foreground" /> : <BotIcon className="w-6 h-6 text-secondary-foreground" />}
                </div>
                <Card className={cn("w-full max-w-[80%]", isUser ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                    <CardContent className="p-3">
                        <p className={`font-semibold mb-1 ${isUser ? 'text-primary-foreground/80' : 'text-secondary-foreground/80'}`}>
                            {isUser ? 'You' : (entry.agentName || 'AI Assistant')}
                        </p>
                        <p className="whitespace-pre-wrap">{entry.content}</p>
                    </CardContent>
                </Card>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <ViewHeader
                icon={<HistoryIcon className="w-6 h-6" />}
                title="Generation History"
                description="Review your past conversations with the AI agents."
            >
                {history.length > 0 && (
                     <Button onClick={handleClearHistory} variant="destructive">
                        Clear History
                    </Button>
                )}
            </ViewHeader>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {history.length === 0 ? (
                    <div className="text-center text-muted-foreground h-full flex items-center justify-center">
                        <p>No history yet. Start a conversation in the Chat view!</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {history.map(entry => <HistoryItem key={entry.id} entry={entry} />)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryView;