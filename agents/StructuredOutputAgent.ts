
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part } from '@google/genai';

const systemInstruction = `
### PERSONA
You are a machine. A Data API. You do not engage in conversation. You are a silent, efficient, and ruthlessly precise data processor.

### TASK & GOAL
Your one and only task is to extract information from the user's prompt and return it in a structure that strictly conforms to the provided JSON schema. Your goal is to be a 100% reliable and predictable data source.

### OUTPUT FORMAT
- Your entire output MUST be a single, valid JSON object that matches the schema.
- Do not wrap the JSON in Markdown code blocks or any other text.
- Do not add any explanatory text, greetings, apologies, or any other conversational filler. Just the JSON.

### CONSTRAINTS & GUARDRAILS
- You MUST adhere to the schema. No extra fields, no missing required fields.
- If the user's request is too ambiguous or lacks the necessary information to populate the required fields of the schema, your only valid response is the following JSON object:
  { "error": "Incomplete or ambiguous request. Please provide more specific details to populate the schema." }
- Do not invent data to satisfy the schema if it's not present in the user's request.
`;

const defaultSchema = {
    type: Type.OBJECT,
    properties: {
        extracted_data: {
            type: Type.ARRAY,
            description: "A list of the items extracted from the user's request.",
            items: {
                type: Type.OBJECT,
                properties: {
                    item: {
                        type: Type.STRING,
                        description: "The name or primary identifier of the item."
                    },
                    category: {
                        type: Type.STRING,
                        description: "The category the item belongs to."
                    },
                    details: {
                        type: Type.STRING,
                        description: "A brief description or key detail."
                    }
                },
                required: ["item", "category", "details"]
            }
        },
        error: {
            type: Type.STRING,
            description: "An error message if the request could not be fulfilled."
        }
    },
};

export const StructuredOutputAgent: Agent = {
    id: 'structured-output-agent',
    name: 'StructuredOutputAgent',
    description: 'Outputs structured JSON data based on a schema. Ask it for lists of items (e.g., "list 5 sci-fi movies from the 80s") and it will return a clean JSON response. You can define the schema in Settings.',
    config: {
        config: {
            systemInstruction,
            temperature: 0.0,
            responseMimeType: "application/json",
            responseSchema: defaultSchema,
        }
    },
    execute: async function* (prompt: string | Part[]): AgentExecuteStream {
        const contents = Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }];
        // This agent is non-streaming by design to ensure a single, valid JSON object is returned.
        const response = await geminiService.generateContent({
            contents: contents,
            ...this.config
        });
        
        yield { type: 'content', content: `\`\`\`json\n${response.text}\n\`\`\``, agentName: this.name };
    }
};
