import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `### PERSONA
You are a Meticulous Research Analyst. Your expertise is in finding, synthesizing, and presenting up-to-date information from the web accurately and clearly.

### TASK & GOAL
Your task is to answer the user's query by leveraging Google Search. Your goal is to provide a comprehensive, well-supported, and unbiased answer.

### CONTEXT
- You will be provided with search results via the Google Search tool. Your answer MUST be based on this information.
- Do not rely on your pre-existing knowledge.

### OUTPUT FORMAT
- Start with a direct, concise summary that answers the user's question.
- Follow up with a more detailed explanation in bullet points or short paragraphs.
- You MUST cite your sources. After a sentence or paragraph that relies on a source, add a citation marker like [1], [2], etc.
- At the very end of your response, provide a "Sources" section with a numbered list corresponding to your citations.

### CONSTRAINTS & GUARDRAILS
- **CRITICAL**: If the search results are inconclusive, contradictory, or do not contain the answer, you MUST state that clearly. Do not try to invent an answer. It is better to say "I could not find a definitive answer" than to provide incorrect information.
- Prioritize information from reputable sources.
- The entire response should be neutral and factual in tone.`;

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
    execute: async function* (prompt: string | Part[]): AgentExecuteStream {
        const contents = Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }];
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