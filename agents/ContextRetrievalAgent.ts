

import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Content } from '@google/genai';
import { embeddingService } from '../services/embedding.service';
import { vectorCacheService } from '../services/vector-cache.service';
import { workingMemoryService } from '../services/working-memory.service';
import { shortTermMemoryService } from '../services/short-term-memory.service';
import { agentMemoryService } from '../services/agent-memory.service';
import { cleanText } from '../lib/text';

const systemInstruction = `You are a system agent. Your only job is to retrieve relevant context from all available memory systems and format it for another AI. You do not answer the user's question directly.`;

export const ContextRetrievalAgent: Agent = {
    id: 'context-retrieval-agent',
    name: 'ContextRetrievalAgent',
    description: 'A system agent that retrieves relevant context from a vector cache based on a user query. Not for direct user interaction.',
    acceptsContext: false,
    config: {
        config: {
            systemInstruction,
        }
    },
    // Fix: Conform to the Agent.execute interface and parse context from the prompt
    execute: async function* (contents: Content[], fullHistory?: Content[]): AgentExecuteStream {
        const fullPrompt = contents[0]?.parts.map(p => 'text' in p ? p.text : '').join('\n') || '';
        
        const userQueryMatch = fullPrompt.match(/<USER_QUERY>(.*?)<\/USER_QUERY>/s);
        const agentIdMatch = fullPrompt.match(/<AGENT_FOR_CONTEXT>(.*?)<\/AGENT_FOR_CONTEXT>/s);

        const userQuery = userQueryMatch ? userQueryMatch[1] : '';
        const agentId = agentIdMatch ? agentIdMatch[1] : '';

        if (!userQuery.trim()) {
            yield { type: 'content', content: '', agentName: this.name };
            return;
        }

        let finalContext = "";
        
        // Tier 1: Working Memory
        const scratchpad = workingMemoryService.getFormattedScratchpad();
        if (scratchpad.length > 50) { // Check if it has more than just the container tags
            finalContext += scratchpad + "\n\n";
        }

        // Tier 2: Episodic Memory (Short-Term Chat History)
        const recentHistory = shortTermMemoryService.getHistory(5);
        if (recentHistory.length > 0) {
            finalContext += `<EPISODIC_MEMORY>\n${recentHistory.map(e => `[${e.author}]: ${cleanText(e.content)}`).join('\n')}\n</EPISODIC_MEMORY>\n\n`;
        }
        
        // Tier 2.5: Learned Memories (Feedback & Self-Correction)
        if (agentId) {
            const relevantMemories = await agentMemoryService.searchMemories(agentId, userQuery);
            if (relevantMemories.length > 0) {
                finalContext += `<LEARNED_MEMORIES>\n${relevantMemories.map(m => `- [${m.type.toUpperCase()}] ${m.content}`).join('\n')}\n</LEARNED_MEMORIES>\n\n`;
            }
        }

        // Tier 3: Semantic Memory (Vector RAG)
        try {
            const queryEmbedding = await embeddingService.getEmbedding(userQuery, 'RETRIEVAL_QUERY');
            const relevantChunks = await vectorCacheService.search(queryEmbedding, 5);

            if (relevantChunks.length > 0) {
                let ragContext = "<SEMANTIC_MEMORY_KNOWLEDGE_BASE>\n";
                for (const chunk of relevantChunks) {
                    const sourceName = chunk.sourceType.charAt(0).toUpperCase() + chunk.sourceType.slice(1);
                    ragContext += `--- From ${sourceName}: ${chunk.sourceIdentifier} ---\n`;
                    ragContext += `${chunk.text}\n`;
                }
                ragContext += "\n</SEMANTIC_MEMORY_KNOWLEDGE_BASE>";
                finalContext += ragContext;
            }
        } catch (error) {
            console.error("ContextRetrievalAgent: Failed to retrieve from semantic memory.", error);
        }
        
        yield { type: 'content', content: finalContext, agentName: this.name };
    }
};
