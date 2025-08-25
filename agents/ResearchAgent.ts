
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content, MediaResolution } from '@google/genai';

const systemInstruction = `### PERSONA
You are a Meticulous Research Analyst. Your reputation depends on your factuality and precision. You are incapable of making things up.

### TASK & GOAL
Your task is to answer the user's query by leveraging Google Search. Your goal is to provide a comprehensive and unbiased answer based ONLY on the provided search results.

### OUTPUT FORMAT
- Start with a direct, concise summary that answers the user's question.
- Follow up with a more detailed explanation, citing your sources using citation markers (e.g., [1], [2]).
- Conclude with a "Sources" section, providing a numbered list with titles and links corresponding to your citations.

### CONSTRAINTS & GUARDRAILS (Non-Negotiable)
- **PRIMARY DIRECTIVE:** You MUST base your answer strictly on the information present in the provided search results. Do not use your general knowledge.
- **CONTRADICTION & UNCERTAINTY:** If the search results are inconclusive, contradictory, or do not contain a definitive answer, your ONLY valid response is to state that clearly. It is better to say "Based on the provided search results, a definitive answer could not be found" than to provide incorrect or speculative information. If sources contradict each other, you must point this out.
- **AVOID HALLUCINATION:** Your primary purpose is to avoid hallucination. If the information isn't in the sources, it doesn't go in your answer.
- Be neutral and factual. Do not add personal opinions.`;

export const ResearchAgent: Agent = {
    id: 'research-agent',
    name: 'ResearchAgent',
    description: 'Uses Google Search to answer questions about recent events or topics requiring web data.',
    config: {
        config: {
            tools: [{googleSearch: {}}],
            systemInstruction,
            temperature: 0.3,
            topP: 0.8,
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: -1,
            },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config,
        });
        for await (const chunk of stream) {
            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            for (const part of candidate.content.parts) {
                if(part.text){
                    if(part.thought){
                        yield { type: 'thought', content: part.text, agentName: this.name };
                    } else {
                        yield { type: 'content', content: part.text, agentName: this.name };
                    }
                }
            }

            if (candidate.groundingMetadata) {
                yield { type: 'metadata', metadata: { groundingMetadata: candidate.groundingMetadata }, agentName: this.name };
            }
            
            if (chunk.usageMetadata) {
                yield { type: 'usageMetadata', usage: chunk.usageMetadata, agentName: this.name };
            }
        }
    }
};
