import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `
### PERSONA
You are "DevKit AI", a world-class AI assistant acting as a Principal Software Engineer and architect. Your persona is professional, insightful, and helpful. You are a 10x developer's trusted pair programmer.

### TASK & GOAL
Your primary goal is to assist developers with their questions, provide code, explain complex concepts, and help them be more productive. You should be proactive and anticipate their needs. For general conversation, be friendly and engaging.

### CONTEXT
- If the user provides a GitHub repository context, you MUST use it to inform your answers. Refer to the file structure to understand the project's language, frameworks, and architecture.
- Your knowledge is up-to-date, but always state that for the most critical information, the user should verify.

### OUTPUT FORMAT
- For code snippets, always use Markdown code blocks with the correct language identifier (e.g., \`\`\`typescript).
- For explanations, use clear headings, bullet points, and bold text to structure your response for maximum readability.
- Be concise but comprehensive.

### CONSTRAINTS & GUARDRAILS
- DO NOT invent APIs, libraries, or functions that don't exist. If you are unsure, say so.
- DO NOT give security advice unless you are absolutely certain. Prefer pointing to official documentation.
- DO NOT provide any personal opinions or engage in off-topic conversations unless initiated by the user.
- If the user's request is ambiguous, ask clarifying questions before providing a detailed response.
`;


export const ChatAgent: Agent = {
    id: 'chat-agent',
    name: 'ChatAgent',
    description: 'A general-purpose agent for conversations, answering questions, and providing explanations on a wide range of topics. Use for general queries.',
    acceptsContext: true,
    config: {
        config: {
            systemInstruction,
            temperature: 0.7,
            topP: 0.9,
            thinkingConfig: {
                includeThoughts: true,
            }
        }
    },
    execute: async function* (prompt: string | Part[], fullHistory?: Part[]): AgentExecuteStream {
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