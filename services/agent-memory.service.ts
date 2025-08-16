

import { get, set, del, keys } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';

export interface AgentMemory {
    id: string;
    content: string;
    type: 'self-generated' | 'feedback';
    timestamp: number;
    weight: number; // Importance of the memory
    lastAccessed: number;
}

const getStoreKey = (agentId: string) => `memory::${agentId}`;

class AgentMemoryService {
    
    async addMemory(agentId: string, memory: Omit<AgentMemory, 'id' | 'timestamp' | 'weight' | 'lastAccessed'>): Promise<void> {
        try {
            const now = Date.now();
            const newMemory: AgentMemory = {
                id: uuidv4(),
                timestamp: now,
                lastAccessed: now,
                weight: memory.type === 'feedback' ? 1.0 : 0.5, // Feedback is more important
                ...memory,
            };
            const allMemories = await this.getMemories(agentId);
            allMemories.push(newMemory);

            // Keep only the 50 most recent memories to prevent unlimited growth
            if (allMemories.length > 50) {
                allMemories.sort((a, b) => b.timestamp - a.timestamp).splice(50);
            }
            
            await set(getStoreKey(agentId), allMemories);
        } catch (error) {
            console.error(`AgentMemoryService: Failed to add memory for agent ${agentId}:`, error);
        }
    }

    async getMemories(agentId: string): Promise<AgentMemory[]> {
        try {
            const memories = await get<AgentMemory[]>(getStoreKey(agentId));
            return (memories || []).sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error(`AgentMemoryService: Failed to get memories for agent ${agentId}:`, error);
            return [];
        }
    }

    async searchMemories(agentId: string, query: string, maxResults: number = 5): Promise<AgentMemory[]> {
        const allMemories = await this.getMemories(agentId);
        if (!query.trim() || allMemories.length === 0) return [];

        const queryWords = query.toLowerCase().split(/\s+/);
        
        const scoredMemories = allMemories.map(memory => {
            const content = memory.content.toLowerCase();
            let score = memory.weight * 10; // Start with base weight
            
            queryWords.forEach(word => {
                if (content.includes(word)) {
                    score++;
                }
            });
            return { memory, score };
        });

        const topMemories = scoredMemories
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(item => item.memory);
        
        // Update lastAccessed timestamp for retrieved memories
        if (topMemories.length > 0) {
            const now = Date.now();
            const memoryMap = new Map(allMemories.map(m => [m.id, m]));
            topMemories.forEach(mem => {
                const originalMem = memoryMap.get(mem.id);
                if (originalMem) originalMem.lastAccessed = now;
            });
            await set(getStoreKey(agentId), Array.from(memoryMap.values()));
        }
        
        return topMemories;
    }
    
    async deleteMemory(agentId: string, memoryId: string): Promise<void> {
        try {
            let allMemories = await this.getMemories(agentId);
            allMemories = allMemories.filter(m => m.id !== memoryId);
            await set(getStoreKey(agentId), allMemories);
            console.log(`AgentMemoryService: Deleted memory ${memoryId} for agent ${agentId}`);
        } catch (error) {
            console.error(`AgentMemoryService: Failed to delete memory ${memoryId} for agent ${agentId}`, error);
        }
    }

    async clearAllMemories(bypassConfirm = false): Promise<void> {
        if (!bypassConfirm && !window.confirm("Are you sure you want to clear all learned memories for every agent? This action cannot be undone.")) {
            return;
        }
        try {
            const allKeys = await keys();
            const memoryKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith('memory::'));
            await Promise.all(memoryKeys.map(key => del(key)));

            console.log("All agent memories cleared.");
        } catch (error) {
            console.error("AgentMemoryService: Failed to clear all memories:", error);
            throw error;
        }
    }
}

export const agentMemoryService = new AgentMemoryService();