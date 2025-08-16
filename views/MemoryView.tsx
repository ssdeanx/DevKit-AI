

import React, { useState, useEffect, useCallback } from 'react';
import { agentService } from '../services/agent.service';
import { agentMemoryService, AgentMemory } from '../services/agent-memory.service';
import { Agent } from '../agents/types';
import { DatabaseIcon, CloseIcon, BrainIcon } from '../components/icons';
import ViewHeader from '../components/ViewHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import EmptyState from '../components/EmptyState';

const MemoryItem: React.FC<{ memory: AgentMemory, onDelete: (id: string) => void }> = ({ memory, onDelete }) => {
    return (
        <Card className="group relative">
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => onDelete(memory.id)}
            >
                <CloseIcon className="w-4 h-4" />
            </Button>
            <CardContent className="p-4">
                <p className="text-sm">{memory.content}</p>
                <div className="text-xs text-muted-foreground mt-3 pt-3 border-t flex justify-between items-center">
                    <span 
                        className={cn("font-semibold capitalize px-2 py-0.5 rounded-full",
                            memory.type === 'feedback' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                        )}
                    >
                        {memory.type.replace('-', ' ')}
                    </span>
                    <span>Weight: {memory.weight.toFixed(1)}</span>
                    <span>{new Date(memory.timestamp).toLocaleString()}</span>
                </div>
            </CardContent>
        </Card>
    );
};

const MemoryView: React.FC = () => {
    const [agents] = useState<Agent[]>(() => agentService.getAgents());
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [memories, setMemories] = useState<AgentMemory[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchMemories = useCallback(async (agentId: string) => {
        setIsLoading(true);
        const agentMemories = await agentMemoryService.getMemories(agentId);
        setMemories(agentMemories);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (selectedAgentId) {
            fetchMemories(selectedAgentId);
        } else {
            setMemories([]);
        }
    }, [selectedAgentId, fetchMemories]);
    
    const handleDeleteMemory = async (memoryId: string) => {
        if (selectedAgentId) {
            await agentMemoryService.deleteMemory(selectedAgentId, memoryId);
            fetchMemories(selectedAgentId); // Refresh memories after deletion
        }
    };

    return (
        <div className="flex flex-col h-full">
            <ViewHeader
                icon={<DatabaseIcon className="w-6 h-6" />}
                title="Agent Memory Inspector"
                description="View and manage the long-term memories for each AI agent."
            />
            <div className="flex-1 p-6 space-y-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="max-w-md">
                            <label htmlFor="agent-select" className="text-sm font-medium mb-2 block">Select an Agent</label>
                            <Select onValueChange={setSelectedAgentId} value={selectedAgentId || ''}>
                                <SelectTrigger id="agent-select">
                                    <SelectValue placeholder="Choose an agent to inspect..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map(agent => (
                                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="flex-1">
                    {selectedAgentId && !isLoading && (
                        <>
                            <h2 className="text-lg font-semibold mb-4">
                                Memories for {agents.find(a => a.id === selectedAgentId)?.name} ({memories.length})
                            </h2>
                            {memories.length > 0 ? (
                                <div className="space-y-4">
                                    {memories.map(mem => <MemoryItem key={mem.id} memory={mem} onDelete={handleDeleteMemory} />)}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center py-8">This agent has no long-term memories yet.</p>
                            )}
                        </>
                    )}
                    
                    {!selectedAgentId && (
                        <EmptyState
                            icon={<BrainIcon className="w-10 h-10" />}
                            title="Select an agent"
                            description="Choose an agent from the dropdown above to view its learned memories."
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MemoryView;