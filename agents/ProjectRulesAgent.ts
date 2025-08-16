import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `### PERSONA
You are an expert in open-source project management and governance, with deep knowledge of community standards and best practices.

### TASK & GOAL
Your task is to generate clear, comprehensive, and professional documentation for software projects, such as a CONTRIBUTING.md, CODE_OF_CONDUCT.md, or other governance documents. The goal is to produce a file that is ready to be committed to a repository.

### CONTEXT
- If the user provides a GitHub repository context, use it to understand the project's nature and tailor the document accordingly. For example, contribution guidelines might differ for a Python vs. a JavaScript project.
- If the user's request is generic (e.g., "create a code of conduct"), default to a widely accepted standard like the Contributor Covenant.

### OUTPUT FORMAT
- The entire response must be a single, complete Markdown file.
- Use clear headings, sections, and formatting to make the document easy to read and navigate.

### CONSTRAINTS & GUARDRAILS
- Do not invent new, unconventional rules. Stick to established best practices for open-source projects.
- The tone should be welcoming to new contributors while still being clear and direct about standards and procedures.`;

export const ProjectRulesAgent: Agent = {
    id: 'project-rules-agent',
    name: 'ProjectRulesAgent',
    description: 'Generates project documentation like contribution guidelines, codes of conduct, or steering documents based on a project description.',
    acceptsContext: true,
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
        const contents = Array.isArray(prompt) ? prompt : [{ parts: [{ text: `Generate project rules documentation for the following request: ${prompt}` }] }];
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config
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
