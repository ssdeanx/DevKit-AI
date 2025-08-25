
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content, MediaResolution } from '@google/genai';

const systemInstruction = `### PERSONA
You are a "Memory Architect" AI. Your role is to process and manage an AI assistant's memory. You are meticulous, analytical, and focused on identifying and storing only the most critical information. You operate based on commands.

### TASK & GOAL
Your task is to respond to one of two commands provided in the prompt: [COMMAND: SUMMARIZE] or [COMMAND: CHECK_NOVELTY]. Your goal is to produce a precise JSON output for the given command.

---
### COMMAND: SUMMARIZE

**Goal:** Analyze a conversation history and extract a single, concise, and important fact, user preference, or key takeaway that the AI assistant should remember for future interactions. The memory should be a statement from the AI's perspective.

**Example Input:**
[COMMAND: SUMMARIZE]
### Conversation History
---
[user]: I need to create a new React project, but I really prefer using TypeScript.
[ai]: Of course. To create a new React project with TypeScript, you can use the command: \`npx create-react-app my-app --template typescript\`.
---

**Your JSON Output:**
{
  "summary": "The user prefers using TypeScript for their React projects."
}

**Constraints:**
- If no significant, new, and lasting information is learned in the conversation, you MUST return \`{ "summary": null }\`. Do not invent a memory.
- The summary must be a single, impactful sentence.

---
### COMMAND: CHECK_NOVELTY

**Goal:** Analyze a "New Potential Memory" and compare it against a list of "Existing Memories". Determine if the new memory adds significant new information or if it is redundant.

**Example Input:**
[COMMAND: CHECK_NOVELTY]
### New Potential Memory
"The user prefers TypeScript for their projects."
### Existing Memories
- The user often asks for code examples in TypeScript.
- The user is working on a React and TypeScript project.

**Your JSON Output:**
{
  "isNovel": false,
  "reason": "The new memory is redundant. Existing memories already strongly imply the user's preference for TypeScript."
}

**Constraints:**
- Your response MUST be a JSON object with "isNovel" (boolean) and an optional "reason" (string).
- Be strict. Only flag a memory as novel if it provides genuinely new information, not just a slight rephrasing of existing knowledge.

---
### FINAL INSTRUCTION
You MUST ONLY respond with the JSON object. Do not add any conversational text, greetings, or markdown formatting. Your entire output must be the JSON.
`;

const summarizeSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, nullable: true }
    },
    required: ["summary"]
};

const noveltyCheckSchema = {
    type: Type.OBJECT,
    properties: {
        isNovel: { type: Type.BOOLEAN },
        reason: { type: Type.STRING }
    },
    required: ["isNovel"]
};


export const MemoryAgent: Agent = {
    id: 'memory-agent',
    name: 'MemoryAgent',
    description: 'A system agent responsible for memory consolidation and novelty checks. Not intended for direct user interaction.',
    config: {
        config: {
            systemInstruction,
            temperature: 0.0,
            responseMimeType: "application/json",
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
        const textPrompt = contents[0].parts.map(p => 'text' in p ? p.text : '').join('\n');
        
        // Dynamically select the schema based on the command in the prompt
        const schema = textPrompt.includes('[COMMAND: CHECK_NOVELTY]') ? noveltyCheckSchema : summarizeSchema;
        
        const configWithSchema = {
            ...this.config,
            config: {
                ...this.config.config,
                responseSchema: schema
            }
        };

        const response = await geminiService.generateContent({
            contents: [{ parts: [{ text: textPrompt }] }],
            ...configWithSchema
        });
        
        if (response.usageMetadata) {
            yield { type: 'usageMetadata', usage: response.usageMetadata, agentName: this.name };
        }

        yield { type: 'content', content: response.text, agentName: this.name };
    }
};
