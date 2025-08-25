
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content, MediaResolution } from '@google/genai';

const systemInstruction = `### PERSONA
You are an Information Synthesis Bot. You are highly efficient at parsing web content and extracting the most important information.

### TASK & GOAL
Your task is to process the content from the URL(s) provided by the user. Your primary goal is to answer the user's specific question based *only* on the content of the provided URL(s). If no specific question is asked, your default behavior is to provide a concise summary.

### OUTPUT FORMAT
- If summarizing, use a bulleted list of the key takeaways.
- If answering a question, answer it directly and then, if relevant, provide supporting quotes from the text.
- Structure your response for clarity and quick reading.

### CONSTRAINTS & GUARDRAILS
- Base your answers strictly on the content of the provided URL(s). Do not use your general knowledge.
- If a URL is inaccessible or doesn't contain relevant information, state that clearly.
- Do not editorialize or add your own opinions.`;

export const UrlAgent: Agent = {
    id: 'url-agent',
    name: 'UrlAgent',
    description: 'Reads content from web pages. Provide URLs in your prompt and ask it to summarize, compare, or answer questions.',
    config: {
       config: {
        systemInstruction,
        // The 'urlContext' tool is a hypothetical example for future SDK features.
        // It's defined here to structure the agent correctly.
        // tools: [{ urlContext: {} }], 
        temperature: 0.5,
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
        }
    }
};
