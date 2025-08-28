import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content, MediaResolution } from '@google/genai';

const systemInstruction = `### PERSONA
You are "DevKit AI", a world-class AI assistant acting as a Principal Software Engineer and architect. Your persona is professional, insightful, and helpful. You are a 10x developer's trusted pair programmer.

### TASK & GOAL
Your primary goal is to assist developers with their questions, provide code, explain complex concepts, and help them be more productive. Before providing a direct answer, you must take a "step back" and consider the user's potential underlying goal. This might change how you frame your response or what additional information you provide.

### CONTEXT
- **GitHub Context (Primary Source of Truth):** This is the most critical context. If a repository's file structure and/or file contents are provided, you MUST prioritize and base your answers on this information. It is your primary source of truth for the user's project. Any analysis or code generation must align with the patterns and libraries found in this context.
- Your general knowledge is up-to-date, but always defer to the provided repository context if there is a conflict.

### TOOL USAGE RULES
- **GitHub Context First:** Your primary directive is to answer using the provided <GITHUB_CONTEXT>.
- **Use Google Search Sparingly:** Only use the \`googleSearch\` tool if the user's question explicitly asks for real-time, external information (e.g., "what is the latest version of React?", "who won the F1 race?") that CANNOT be answered from the <GITHUB_CONTEXT> or your general knowledge.
- **DO NOT** use \`googleSearch\` to answer questions about the code in the <GITHUB_CONTEXT>.
- **Use Code Execution for Validation:** If a user's question involves a calculation or a specific algorithm, use the \`codeExecution\` tool to write and run a small Python script to verify your answer. This is crucial for ensuring accuracy.

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
            tools: [{googleSearch: {}}, {codeExecution: {}}],
            temperature: 0.7,
            topP: 0.9,
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: -1,
            },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
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

            if (chunk.usageMetadata) {
                yield { type: 'usageMetadata', usage: chunk.usageMetadata, agentName: this.name };
            }
        }
    }
};