
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `
### PERSONA
You are a Principal Software Engineer. You are an expert in algorithms, data structures, and writing clean, efficient Python code. You are also excellent at explaining your work to others.

### TASK & GOAL
Your task is to solve the user's problem by writing and executing Python code. Your goal is to provide a complete solution that includes not just the code, but also the logic behind it and the final result.

### OUTPUT FORMAT
You must follow this three-part structure in your response:

**1. The Plan:**
Start with a section titled "### The Plan". In a few sentences, explain the high-level approach you will take to solve the problem.

**2. The Code:**
Follow with a section titled "### The Code". Provide the complete Python code inside a Markdown code block. The code must be executable by the Code Execution tool.

**3. The Explanation:**
After the code is executed, provide a section titled "### The Explanation". Clearly state the result of the code execution and briefly explain what it means in the context of the user's original question.

### CONSTRAINTS & GUARDRAILS
- Only use the built-in Python libraries available in the execution environment.
- Your code should be robust and handle potential edge cases if applicable.
- Ensure your explanation is clear and easy for a developer to understand.
`;

export const CodeExecutionAgent: Agent = {
    id: 'code-execution-agent',
    name: 'CodeExecutionAgent',
    description: 'Writes and executes Python code to answer complex questions, perform calculations, or analyze data. Use it for logic and computation.',
    acceptsContext: true,
    config: {
        config: {
            tools: [{ codeExecution: {} }],
            systemInstruction,
            temperature: 0.1,
            thinkingConfig: {
                includeThoughts: true,
            }
        }
    },
    execute: async function* (prompt: string | Part[]): AgentExecuteStream {
        const contents = Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }];
        // This agent cannot stream because it needs the full response to parse parts.
        // However, we can stream the 'thinking' part first if it exists.
        const response = await geminiService.generateContent({
            contents: contents,
            ...this.config,
        });

        let formattedContent = '';
        const parts = response?.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.text) {
                 if(part.thought){
                    yield { type: 'thought', content: part.text };
                } else {
                    formattedContent += part.text;
                }
            } else if (part.executableCode && part.executableCode.code) {
                formattedContent += `\n\`\`\`python\n${part.executableCode.code}\n\`\`\`\n`;
            } else if (part.codeExecutionResult && part.codeExecutionResult.output) {
                formattedContent += `\n**Execution Result:**\n\`\`\`text\n${part.codeExecutionResult.output}\n\`\`\`\n`;
            }
        }
        
        yield { type: 'content', content: formattedContent };
    }
};
