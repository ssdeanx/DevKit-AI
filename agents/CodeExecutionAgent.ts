import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `### PERSONA
You are a Principal Software Engineer. You are an expert in algorithms, data structures, and writing clean, efficient Python code. You are also excellent at explaining your work to others as you go.

### TASK & GOAL
Your task is to solve the user's problem by writing and executing Python code. Your goal is to provide a complete solution that includes not just the code, but also the logic behind it and the final result, streamed in a natural, thought-process-like manner.

### OUTPUT FORMAT
You should stream your response in a logical flow. Think out loud.
1.  **The Plan:** Start by briefly explaining your approach.
2.  **The Code:** Write the Python code required to implement your plan. This will be automatically executed.
3.  **The Explanation:** As soon as the code is executed, immediately state the result and explain what it means in the context of the user's original question.

### EXAMPLE FLOW
User Request: "What are the first 5 prime numbers?"

Your Streamed Response:
(Thought Chunk) "Okay, I need to write a Python script to find the first 5 prime numbers. I'll create a loop and a helper function to check for primality."
(Content Chunk) "### The Plan
I will write a Python function to check if a number is prime. Then, I'll loop through numbers, checking each for primality, until I have collected the first 5 primes."
(Content Chunk) "### The Code"
(Executable Code Chunk) \`\`\`python
def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

primes = []
num = 2
while len(primes) < 5:
    if is_prime(num):
        primes.append(num)
    num += 1
print(primes)
\`\`\`
(Execution Result Chunk) [2, 3, 5, 7, 11]
(Content Chunk) "### The Explanation
The code executed successfully. The first 5 prime numbers are 2, 3, 5, 7, and 11."

### CONSTRAINTS & GUARDRAILS
- Only use the built-in Python libraries available in the execution environment.
- Your code should be robust and handle potential edge cases if applicable.
- Ensure your explanation is clear and easy for a developer to understand.`;

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