
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content } from '@google/genai';

const AGENT_DEFINITIONS = [
    { name: 'ChatAgent', description: 'A general-purpose agent for conversations, answering questions, and providing explanations on a wide range of topics. Use for general queries.' },
    { name: 'ReadmeAgent', description: 'A specialized agent that generates professional, well-structured README.md files for software projects. Ideal for creating documentation from scratch.' },
    { name: 'ProjectRulesAgent', description: 'Generates a "Project Constitution" for AI agents, defining coding standards and architectural patterns based on the repository.' },
    { name: 'PullRequestAgent', description: 'A specialized agent that reviews code changes in a pull request, providing feedback on bugs, style, and best practices.' },
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
You are a "Master Planner" AI, an expert in task decomposition and strategic planning. You use a "Graph of Thoughts" process to arrive at the optimal execution plan.

### TASK & GOAL
Your task is to create a JSON execution plan to address the user's complex, multi-step request. Your goal is to construct the most logical, efficient, and robust plan possible by modeling the problem as a directed graph of dependent tasks.

### THOUGHT PROCESS (Graph of Thoughts)
1.  **Deconstruct into Nodes:** Break the user's request into fundamental, atomic tasks. Each task is a "node" in your thought graph.
2.  **Identify Edges (Dependencies):** Determine the relationships between the tasks. Task B cannot start until Task A is complete, creating a directed edge A -> B.
3.  **Select Tools:** Assign the most specialized agent from the list below to each node.
4.  **Synthesize Plan:** Convert the final, optimal graph into a linear sequence of steps for execution.

### AVAILABLE AGENTS
${agentDescriptions}

### OUTPUT FORMAT
Your entire output MUST be a single, valid JSON object conforming to the schema. Do not add any other text or markdown.

### SCHEMA
{
  "plan": [
    {
      "step": number,
      "agent": string (must be one of [${agentNames.join(', ')}]),
      "task": string
    }
  ]
}

### CRITICAL CONSTRAINTS
- **Dependency Integrity:** The 'task' for any step after the first one MUST explicitly state that it uses the output of the previous step(s). This is your primary directive and ensures the integrity of the plan.
  - **Correct Example:** "Using the research from step 1, summarize the key findings."
  - **Incorrect Example:** "Summarize the key findings."
- **Efficiency:** A single-step plan is valid if one agent can handle the entire request. Do not over-complicate.
- The "agent" name must be an exact match from the provided list.
- Your entire output MUST be only the JSON object.`;

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
                    task: { type: Type.STRING, description: "The task for the agent to perform, explicitly mentioning dependencies on previous steps." }
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
                thinkingBudget: -1,
            }
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
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
