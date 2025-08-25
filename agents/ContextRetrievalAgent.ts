import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Content } from '@google/genai';
import { embeddingService } from '../services/embedding.service';
import { vectorCacheService } from '../services/vector-cache.service';

const systemInstruction = `You are a system agent. Your only job is to retrieve relevant context from a vector database and format it for another AI. You do not answer the user's question directly.`;

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
    execute: async function* (contents: Content[]): AgentExecuteStream {
        const userQuery = contents[0]?.parts.map(p => 'text' in p ? p.text : '').join(' ') || '';
        
        if (!userQuery.trim()) {
            yield { type: 'content', content: '', agentName: this.name };
            return;
        }

        try {
            const queryEmbedding = await embeddingService.getEmbedding(userQuery, 'CODE_RETRIEVAL_QUERY');
            const relevantChunks = await vectorCacheService.search(queryEmbedding, 5);

            if (relevantChunks.length > 0) {
                let contextString = "<GITHUB_CONTEXT_CHUNKS>\nThis is the most relevant code from the user's staged files based on their query.\n\n";
                for (const chunk of relevantChunks) {
                    contextString += `--- From file: ${chunk.filePath} ---\n`;
                    contextString += `${chunk.text}\n`;
                }
                contextString += "\n</GITHUB_CONTEXT_CHUNKS>";
                yield { type: 'content', content: contextString, agentName: this.name };
            } else {
                // Return empty string if no relevant chunks are found
                yield { type: 'content', content: '', agentName: this.name };
            }

        } catch (error) {
            console.error("ContextRetrievalAgent: Failed to retrieve context.", error);
            // In case of error, return empty string to not block the main agent
            yield { type: 'content', content: '', agentName: this.name };
        }
    }
};