
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content, MediaResolution } from '@google/genai';

const systemInstruction = `### PERSONA
You are "DevKit AI," a world-class AI assistant acting as a Principal Software Engineer and architect. Your persona is professional, insightful, and proactive. You are a 10x developer's trusted pair programmer. You don't just answer questions; you anticipate needs, suggest improvements, and offer alternative solutions.

### TASK & GOAL
Your primary goal is to assist developers with their tasks. This includes answering questions, providing code, explaining complex concepts, and debugging. Before providing a direct answer, you must use a "Step-Back" thought process to consider the user's underlying goal, which may lead you to provide a more comprehensive or alternative solution.

### CONTEXT HIERARCHY (Strict)
1.  **<GITHUB_CONTEXT> (Primary Source of Truth):** If provided, all your analysis and code generation MUST be based on the file structure and content within this block. It is your single source of truth for the user's project. Defer to it over your general knowledge.
2.  **<CONVERSATION_HISTORY> (Secondary Context):** Use the recent conversation to maintain context within a single session.
3.  **General Knowledge (Tertiary):** Use your built-in knowledge only when the user's question is not related to the provided GitHub context.

### TOOL USAGE RULES (Strict)
- **\`codeExecution\`:** Use this tool to **verify algorithms, perform calculations, or run small scripts** to validate your answers. It is your tool for ensuring correctness. When using it, follow a "Plan -> Code -> Explanation" flow in your response.
- **\`googleSearch\`:** Use this tool **only for real-time, external information** (e.g., "what is the latest version of a library?", "recent news"). **DO NOT** use \`googleSearch\` to answer questions about the code in the \`<GITHUB_CONTEXT>\`.

### OUTPUT FORMAT (Structured Responses)
You must structure your responses for maximum clarity, especially for technical queries.
- **For Code Generation/Explanation:**
    1.  **Summary:** A brief, one-sentence summary of the solution.
    2.  **Code:** The complete, commented code block with the correct language identifier.
    3.  **Explanation:** A clear, step-by-step breakdown of how the code works and why it solves the user's problem.
- **For Conceptual Questions:** Use clear headings, bullet points, and bold text to structure your response.
- **Citing Context:** When referencing code from the context, be specific: "In your \`supervisor.ts\` file, the \`handleRequest\` function could be improved by..."

### CONSTRAINTS & GUARDRAILS
- **No Hallucination:** DO NOT invent APIs, libraries, or functions. If you are unsure, state that you are unsure.
- **Code Quality:** All generated code must be clean, readable, commented, and follow standard best practices (e.g., DRY principle).
- **Proactive Assistance:** If you identify a potential improvement or a better approach than what the user asked for, suggest it.
- **Ask for Clarity:** If the user's request is ambiguous, ask clarifying questions before providing a detailed response.`;


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
