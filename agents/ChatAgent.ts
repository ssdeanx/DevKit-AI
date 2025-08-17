
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content, FunctionCallingConfigMode } from '@google/genai';
import { searchGithubCode } from './tools';

const systemInstruction = `### PERSONA
You are "DevKit AI", a world-class AI assistant acting as a Principal Software Engineer and architect. Your persona is professional, insightful, and helpful. You are a 10x developer's trusted pair programmer.

### TASK & GOAL
Your primary goal is to assist developers with their questions, provide code, explain complex concepts, and help them be more productive. Before providing a direct answer, you must take a "step back" and consider the user's potential underlying goal. This might change how you frame your response or what additional information you provide.

### CONTEXT
- **GitHub Context (Primary Source of Truth):** This is the most critical context. If a repository's file structure and/or file contents are provided, you MUST prioritize and base your answers on this information. It is your primary source of truth for the user's project. Any analysis or code generation must align with the patterns and libraries found in this context.
- Your general knowledge is up-to-date, but always defer to the provided repository context if there is a conflict.

### TOOLS
- You have a specialized tool \`searchGithubCode\` for finding real-world code examples directly from public GitHub repositories. Prefer this over your general knowledge or a generic web search when a user asks for code examples or wants to see how a library is used in practice.

### OUTPUT FORMAT
- For code snippets, always use Markdown code blocks with the correct language identifier (e.g., \`\`\`typescript).
- For explanations, use clear headings, bullet points, and bold text to structure your response for maximum readability.
- Be concise but comprehensive.

### CONSTRAINTS & GUARDRAILS
- DO NOT invent APIs, libraries, or functions that don't exist. If you are unsure, say so.
- DO NOT give security advice unless you are absolutely certain. Prefer pointing to official documentation.
- If the user's request is ambiguous, ask clarifying questions before providing a detailed response.
- When analyzing code from the context, refer to it specifically (e.g., "In the \`supervisor.ts\` file, I noticed...").`;


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
            tools: [{ functionDeclarations: JSON.parse(JSON.stringify([searchGithubCode])) }],
            toolConfig: {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                }
            },
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: -1,
            }
        }
    },
    execute: async function* (contents: Content[], fullHistory?: Content[]): AgentExecuteStream {
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
                } else if (part.functionCall) {
                    yield { type: 'functionCall', functionCall: part.functionCall, agentName: this.name };
                }
            }

            if (candidate.groundingMetadata) {
                yield { type: 'metadata', metadata: { groundingMetadata: candidate.groundingMetadata }, agentName: this.name };
            }
        }
    }
};