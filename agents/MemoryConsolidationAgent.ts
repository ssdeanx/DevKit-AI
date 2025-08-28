
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Content } from '@google/genai';

const systemInstruction = `### PERSONA
You are a "Memory Consolidation" AI. Your role is to process and distill an AI assistant's conversation history into concise, important facts for long-term storage. You are analytical and focused on identifying information with lasting value.

### TASK & GOAL
Your task is to analyze a conversation history and extract a single, concise, and important fact, user preference, or key takeaway that the AI assistant should remember for future interactions. The memory should be a statement from the AI's perspective (e.g., "The user prefers...")

### OUTPUT FORMAT
You MUST ONLY respond with a valid JSON object that matches the schema. Do not add any conversational text, greetings, or markdown formatting. Your entire output must be the JSON.

### SCHEMA
{
  "summary": "A single, impactful sentence representing the most important new fact learned, or null if nothing of lasting value was discussed."
}

### CRITICAL CONSTRAINTS
- **Filter for Novelty & Importance:** Do not summarize every conversation. Only create a memory if a *new* and *important* piece of information was revealed. Trivial conversations, corrections that were immediately fixed, or general chit-chat should result in a \`null\` summary.
- **Perspective:** Phrase the memory from the AI's point of view (e.g., "The user is working on a project named 'Apollo'.", "The user prefers to use TailwindCSS for styling.").
- **Conciseness:** The summary must be a single sentence.

### EXAMPLES
**Good Example (Important fact learned):**
- **Conversation:** User mentions they are building a fintech app called 'FinFlow'.
- **Your JSON Output:** \`{ "summary": "The user's current project is a fintech application named 'FinFlow'." }\`

**Good Example (User preference learned):**
- **Conversation:** User asks for all code examples to be in TypeScript.
- **Your JSON Output:** \`{ "summary": "The user has a strong preference for TypeScript code examples." }\`

**Bad Example (Trivial conversation):**
- **Conversation:** User asks "what is a promise in javascript?", AI explains it.
- **Your JSON Output:** \`{ "summary": null }\` (This is general knowledge, not a specific fact about the user or project worth remembering long-term).
`;

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, nullable: true, description: "A single sentence summary of the key takeaway, or null." }
    },
    required: ["summary"]
};

export const MemoryConsolidationAgent: Agent = {
    id: 'memory-consolidation-agent',
    name: 'MemoryConsolidationAgent',
    description: 'A system agent that analyzes conversation history and extracts key facts to be stored in long-term memory.',
    config: {
        config: {
            systemInstruction,
            temperature: 0.0,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
        const response = await geminiService.generateContent({
            contents: contents,
            ...this.config
        });
        
        if (response.usageMetadata) {
            yield { type: 'usageMetadata', usage: response.usageMetadata, agentName: this.name };
        }

        yield { type: 'content', content: response.text, agentName: this.name };
    }
};
