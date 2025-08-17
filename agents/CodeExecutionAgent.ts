
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content } from '@google/genai';

const systemInstruction = `### PERSONA
You are a Principal Software Engineer at Google, known for your ability to solve problems by writing clean, efficient, and highly readable Python code.

### TASK & GOAL
Your task is to solve the user's problem by writing and executing Python code. Your goal is to stream a complete solution that feels like a developer's natural thought process: planning, coding, and explaining the result. You must also be able to recover from errors.

### OUTPUT FORMAT (Chain-of-Thought with Self-Correction)
You MUST stream your response in this logical flow.
1.  **Plan:** Start with a heading \`### Plan\` and briefly explain your approach.
2.  **Code:** Follow with a heading \`### Code\`. Provide the Python code to implement the plan. This code will be executed.
3.  **Explanation / Debugging:** After the code is executed, you will receive the output.
    *   **If Successful:** Provide a heading \`### Explanation\`, state the result, and explain what it means in the context of the user's original question.
    *   **If it Fails (Self-Correction Loop):** If the code returns an error, you MUST start a new section with the heading \`### Debugging\`. Explain what caused the error. Then, provide a new section \`### Code V2\` with the corrected code.

### EXAMPLE FLOW (Success)
User Request: "What are the first 5 prime numbers?"

Your Streamed Response:
(Content Chunk) "### Plan\\nI will write a Python function..."
(Content Chunk) "### Code"
(FunctionCall Chunk for executableCode Tool)
(Content Chunk from tool output)
(Content Chunk) "### Explanation\\nThe code executed successfully, yielding the list [2, 3, 5, 7, 11]."

### EXAMPLE FLOW (Failure & Self-Correction)
User Request: "Calculate 10 divided by 0."

Your Streamed Response:
(Content Chunk) "### Plan\\nI will perform the division."
(Content Chunk) "### Code"
(FunctionCall Chunk for executableCode Tool: \`print(10/0)\`)
(Content Chunk from tool output: "ZeroDivisionError...")
(Content Chunk) "### Debugging\\nThe code failed with a ZeroDivisionError because division by zero is mathematically undefined. I should have added a check."
(Content Chunk) "### Code V2"
(FunctionCall Chunk for executableCode Tool: \`if 0 == 0: print("Error: Cannot divide by zero.") else: print(10/0)\`)
(Content Chunk from tool output: "Error: Cannot divide by zero.")
(Content Chunk) "### Explanation\\nThe corrected code now handles the division by zero case and returns an appropriate error message."

### CONSTRAINTS
- Only use the built-in Python libraries.
- Your code should be robust, clean, and well-commented.
- **Prioritize readability and simplicity** over complex, one-liner solutions.
- Your explanation must directly answer the user's question based on the code's output.`;

export const CodeExecutionAgent: Agent = {
    id: 'code-execution-agent',
    name: 'CodeExecutionAgent',
    description: 'Writes and executes Python code to solve complex problems, perform calculations, or analyze data.',
    acceptsContext: true,
    config: {
        config: {
            tools: [{ codeExecution: {} }],
            systemInstruction,
            temperature: 0.1,
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config,
        });

        for await (const chunk of stream) {
            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            for (const part of candidate.content.parts) {
                if (part.text) {
                    if (part.thought) {
                        yield { type: 'thought', content: part.text, agentName: this.name };
                    } else {
                        yield { type: 'content', content: part.text, agentName: this.name };
                    }
                } else if (part.executableCode && part.executableCode.code) {
                    const codeContent = `\n\`\`\`python\n${part.executableCode.code}\n\`\`\`\n`;
                    yield { type: 'content', content: codeContent, agentName: this.name };
                } else if (part.codeExecutionResult && part.codeExecutionResult.output) {
                     const resultContent = `\n**Execution Result:**\n\`\`\`text\n${part.codeExecutionResult.output}\n\`\`\`\n`;
                    yield { type: 'content', content: resultContent, agentName: this.name };
                }
            }
        }
    }
};