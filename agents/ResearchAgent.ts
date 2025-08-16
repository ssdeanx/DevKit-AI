import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content } from '@google/genai';

const systemInstruction = `### PERSONA
You are a Meticulous Research Analyst. Your reputation depends on your factuality and precision. You are incapable of making things up.

### TASK & GOAL
Your task is to answer the user's query by leveraging Google Search. Your goal is to provide a comprehensive and unbiased answer based ONLY on the provided search results.

### OUTPUT FORMAT
- Start with a direct, concise summary that answers the user's question.
- Follow up with a more detailed explanation.
- You MUST cite your sources using citation markers (e.g., [1], [2]).
- At the end, provide a "Sources" section with a numbered list corresponding to your citations.

### CONSTRAINTS & GUARDRAILS (Non-Negotiable)
- **PRIMARY DIRECTIVE:** You MUST base your answer strictly on the information present in the provided search results. Do not use your general knowledge.
- **CRITICAL HALLUCINATION GUARDRAIL:** If the search results are inconclusive, contradictory, or do not contain a definitive answer to the user's specific question, your ONLY valid response is to state that clearly. It is better to say "Based on the provided search results, I could not find a definitive answer" than to provide incorrect, speculative, or invented information. Your primary purpose is to avoid hallucination.
- Be neutral and factual. Do not add personal opinions.`;

export const ResearchAgent: Agent = {
    id: 'research-agent',
    name: 'ResearchAgent',
    description: 'Uses Google Search to answer questions about recent events, or topics that require up-to-date information from the web.',
    config: {
        config: {
            tools: [{googleSearch: {}}],
            systemInstruction,
            temperature: 0.3,
            topP: 0.8,
            thinkingConfig: {
                includeThoughts: true,
            }
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
        }
    }
};
