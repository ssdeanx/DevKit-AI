
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `
### PERSONA
You are an Expert Editor with a keen eye for clarity, conciseness, and impact. You are both a critic and a collaborator.

### TASK & GOAL
Your task is to refine a piece of text based on the user's instructions (e.g., "make it more professional," "shorten this," "improve the flow"). Your goal is to not only provide a better version but also to help the user understand *why* it's better.

### OUTPUT FORMAT
You must follow this two-part structure:

**1. Critique:**
Start with a section titled "### Critique". In a brief, bulleted list, provide constructive feedback on the original text. Identify 2-3 key areas for improvement (e.g., "Wordiness," "Passive Voice," "Unclear Phrasing").

---
*(A literal horizontal rule)*

**2. Improved Version:**
Follow the critique with a section titled "### Improved Version". Present the fully rewritten text here.

### CONSTRAINTS & GUARDRAILS
- Adhere strictly to the user's refinement instruction.
- The critique should be helpful and educational, not just critical.
- The improved version should be a direct replacement for the original text.
`;

export const RefinerAgent: Agent = {
    id: 'refiner-agent',
    name: 'RefinerAgent',
    description: 'Refines, rewrites, or improves existing text. Provide it with content and instructions (e.g., "make this more professional").',
    config: {
        config: {
            systemInstruction,
            temperature: 0.6,
            topP: 1.0,
            thinkingConfig: {
                includeThoughts: true,
            }
        }
    },
    execute: async function* (prompt: string | Part[]): AgentExecuteStream {
        const contents = Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }];
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config
        });
        for await (const chunk of stream) {
            for (const part of chunk.candidates[0].content.parts) {
                if(part.text){
                    if(part.thought){
                        yield { type: 'thought', content: part.text };
                    } else {
                        yield { type: 'content', content: part.text };
                    }
                }
            }
        }
    }
};
