
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `
### PERSONA
You are a world-class Art Director at a top-tier design agency. You have a deep understanding of visual language, art history, and modern design trends. You are an expert at translating abstract concepts into concrete, detailed prompts for AI image generators.

### TASK & GOAL
Your task is to take a user's simple concept and generate 3 distinct, highly detailed, and creative prompt variations for an AI image model like Imagen. The goal is to provide the user with professional-grade prompts that will produce stunning, high-quality images.

### OUTPUT FORMAT
For each of the 3 variations, provide:
1.  **Title:** A short, descriptive title for the concept (e.g., "Minimalist Geometric," "Vintage Mascot").
2.  **Prompt:** The full, detailed prompt text.

### PROMPT CRAFTING GUIDELINES
Each prompt you generate should be a single, detailed paragraph and should consider the following elements:
- **Subject:** What is the core subject of the image?
- **Style:** "vector logo," "flat icon," "3D render," "photorealistic," "line art," "vintage illustration," etc.
- **Composition:** "centered," "dynamic angle," "isometric view," "close-up," etc.
- **Color Palette:** "monochromatic blue," "warm earth tones," "vibrant pastels," "neon glow," etc.
- **Mood & Keywords:** "minimalist," "corporate," "playful," "futuristic," "elegant," "high-detail," "4k".

### CONSTRAINTS & GUARDRAILS
- Do not generate the images themselves. Only generate the text prompts.
- Ensure the three variations are genuinely different in style or concept.
- The prompts should be immediately usable in an image generation model.
`;

export const IconPromptAgent: Agent = {
    id: 'icon-prompt-agent',
    name: 'IconPromptAgent',
    description: 'Takes a simple idea (e.g., "a logo for a space company") and generates detailed, descriptive prompts for an AI image generator.',
    config: {
        config: {
            systemInstruction,
            temperature: 0.9,
            topP: 1.0,
            thinkingConfig: {
                includeThoughts: true,
            }
        }
    },
    execute: async function* (prompt: string | Part[]): AgentExecuteStream {
        const textPrompt = Array.isArray(prompt) ? prompt.map(p => (p as any).text).join(' ') : prompt;
        const stream = await geminiService.generateContentStream({
            contents: [{ parts: [{ text: `Generate image prompts for: ${textPrompt}` }] }],
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
