import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part } from '@google/genai';

const AGENT_DEFINITIONS = [
    { name: 'ChatAgent', description: 'A general-purpose agent for conversations, answering questions, and providing explanations on a wide range of topics. Use for general queries.' },
    { name: 'ReadmeAgent', description: 'A specialized agent that generates professional, well-structured README.md files for software projects. Ideal for creating documentation from scratch.' },
    { name: 'ProjectRulesAgent', description: 'Generates project documentation like contribution guidelines, codes of conduct, or steering documents based on a project description.' },
    { name: 'ResearchAgent', description: 'Uses Google Search to answer questions about recent events, or topics that require up-to-date information from the web.' },
    { name: 'RefinerAgent', description: 'Refines, rewrites, or improves existing text. Provide it with content and instructions (e.g., "make this more professional").' },
    { name: 'IconPromptAgent', description: 'Takes a simple idea (e.g., "a logo for a space company") and generates detailed, descriptive prompts for an AI image generator.' },
    { name: 'CodeExecutionAgent', description: 'Writes and executes Python code to answer complex questions, perform calculations, or analyze data. Use it for logic and computation.' },
    { name: 'StructuredOutputAgent', description: 'Outputs structured JSON data based on a schema. Ask it for lists of items (e.g., "list 5 sci-fi movies from the 80s") and it will return a clean JSON response. You can define the schema in Settings.' },
    { name: 'UrlAgent', description: 'Reads content from web pages. Provide URLs in your prompt and ask it to summarize, compare, or answer questions.' },
    { name: 'FunctionCallingAgent', description: 'Uses Function Calling to control the application or perform specific actions. Use this for commands like "navigate to settings" or "change the temperature of the ReadmeAgent".' },
    { name: 'CodeGraphAgent', description: 'Analyzes the file structure of a loaded GitHub repository and generates a visual dependency graph of its components.' }
];

const agentNames = AGENT_DEFINITIONS.map(a => a.name);
const agentDescriptions = AGENT_DEFINITIONS.map(a => `- ${a.name}: ${a.description}`).join('\n');


const systemInstruction = `### PERSONA
You are a "Master Planner" AI. Your expertise is in analyzing complex, multi-step user requests and breaking them down into a logical sequence of tasks. Each task in your plan must be assigned to the most appropriate specialized agent.

### TASK & GOAL
Your task is to create a JSON execution plan. Your goal is to construct a plan that, when executed sequentially, will fully address the user's request. For simple, single-step requests that one agent can handle, you can create a one-step plan.

### CONTEXT
Here are the specialized agents you can delegate tasks to:
${agentDescriptions}

### OUTPUT FORMAT
Your entire output MUST be a single, valid JSON object that conforms to the schema. Do not wrap it in Markdown code blocks.

### SCHEMA
- The root object must have a key "plan" which is an array of "step" objects.
- Each "step" object must contain:
  1. "step" (number): The step number, starting from 1.
  2. "agent" (string): The exact name of the agent best suited for this step. Must be one of [${agentNames.join(', ')}].
  3. "task" (string): A clear and concise instruction for what the chosen agent should do. This instruction should include all necessary context from the original prompt or previous steps.

### EXAMPLE
User Request: "Research the key features of the new Gemini 2.5 Flash model and then write a short, professional paragraph summarizing them for a technical audience."

Your JSON Output:
{
  "plan": [
    {
      "step": 1,
      "agent": "ResearchAgent",
      "task": "Using Google Search, find the key features, performance improvements, and main use cases for the Google Gemini 2.5 Flash model."
    },
    {
      "step": 2,
      "agent": "RefinerAgent",
      "task": "Using the research findings from the previous step, synthesize them into a single, professional paragraph. The tone should be formal and targeted at a technical audience, highlighting the most impactful features."
    }
  ]
}

### CONSTRAINTS & GUARDRAILS
- **CRITICAL**: The 'task' for each subsequent step MUST explicitly use the output of the previous step. For example, the task for step 2 should start with "Using the information from the previous step...". This ensures a logical flow of information.
- Ensure the "task" for each step is self-contained and provides enough information for the agent to work.
- Be efficient. Do not create unnecessary steps. If a single agent can do the job, use a one-step plan.
- Only use the agents listed above.
- Your entire output MUST be a single, valid JSON object that conforms to the schema and nothing else.`;

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        plan: {
            type: Type.ARRAY,
            description: "The array of steps to execute.",
            items: {
                type: Type.OBJECT,
                properties: {
                    step: { type: Type.NUMBER, description: "The step number." },
                    agent: { type: Type.STRING, description: "The name of the agent for this step.", enum: agentNames },
                    task: { type: Type.STRING, description: "The task for the agent to perform." }
                },
                required: ["step", "agent", "task"]
            }
        }
    },
    required: ["plan"]
};


export const PlannerAgent: Agent = {
    id: 'planner-agent',
    name: 'PlannerAgent',
    description: 'Decomposes complex, multi-step tasks into a structured plan for other agents to execute. Use for requests requiring multiple skills (e.g., "research X and then summarize it").',
    config: {
        config: {
            systemInstruction,
            temperature: 0.0,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
             thinkingConfig: {
                includeThoughts: true,
            }
        }
    },
    execute: async function* (prompt: string | Part[]): AgentExecuteStream {
        const contents = Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }];
        
        // This agent is non-streaming for its main content (the plan) to ensure a valid JSON is produced.
        // However, we can still stream its thought process.
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config,
        });

        let fullContent = '';
        for await (const chunk of stream) {
            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            for (const part of candidate.content.parts) {
                if(part.text){
                    if(part.thought){
                        yield { type: 'thought', content: part.text, agentName: this.name };
                    } else {
                        fullContent += part.text;
                    }
                }
            }

            if (candidate.groundingMetadata) {
                yield { type: 'metadata', metadata: { groundingMetadata: candidate.groundingMetadata }, agentName: this.name };
            }
        }
        
        // Yield the final, complete JSON plan.
        yield { type: 'content', content: fullContent, agentName: this.name };
    }
};