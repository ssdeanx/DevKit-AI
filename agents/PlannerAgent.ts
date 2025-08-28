import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content, MediaResolution } from '@google/genai';

const AGENT_DEFINITIONS = [
    { name: 'ChatAgent', description: 'Answers general programming questions, explains code, or engages in conversation. Can also execute code.' },
    { name: 'ReadmeAgent', description: 'Generates a professional README.md file by analyzing project structure and description.' },
    { name: 'ProjectRulesAgent', description: 'Generates a "Project Constitution" defining coding standards based on the repository.' },
    { name: 'PullRequestAgent', description: 'Performs an expert code review of a pull request, providing actionable feedback.' },
    { name: 'IssueLabelAgent', description: 'Analyzes a GitHub issue via its URL and applies the correct labels.'},
    { name: 'ResearchAgent', description: 'Uses Google Search to answer questions about recent events or topics requiring web data.' },
    { name: 'RefinerAgent', description: 'Refines, rewrites, or improves existing text based on a specific instruction (e.g., "make this more professional").' },
    { name: 'IconPromptAgent', description: 'Generates detailed, creative prompts for an AI image generator from a simple idea.' },
    { name: 'ImageRefinementAgent', description: 'A multimodal agent that refines image prompts based on visual and text feedback.'},
    { name: 'CodeExecutionAgent', description: 'Writes and executes Python code to solve complex problems, perform calculations, or analyze data.' },
    { name: 'StructuredOutputAgent', description: 'Outputs structured JSON data based on a schema (e.g., "list 5 movies as a JSON array").' },
    { name: 'UrlAgent', description: 'Summarizes or answers questions about content from a provided web page URL.' },
    { name: 'FunctionCallingAgent', description: 'Controls the application UI or settings via function calls (e.g., "navigate to settings").' },
    { name: 'CodeGraphAgent', description: 'Analyzes the repository file structure and generates a visual dependency graph.' },
    { name: 'ContextOptimizerAgent', description: 'Analyzes a user query and a list of files to select the most relevant subset of files for context. Use this as a first step for complex code queries.' }
];

const agentNames = AGENT_DEFINITIONS.map(a => a.name);
const agentDescriptions = AGENT_DEFINITIONS.map(a => `- **${a.name}**: ${a.description}`).join('\n');


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
    description: 'Decomposes complex, multi-step tasks into a plan for other agents to execute.',
    config: {
        config: {
            systemInstruction,
            temperature: 0.0,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
             thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: -1,
            },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
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

            if (chunk.usageMetadata) {
                yield { type: 'usageMetadata', usage: chunk.usageMetadata, agentName: this.name };
            }
        }
        
        // Yield the final, complete JSON plan.
        yield { type: 'content', content: fullContent, agentName: this.name };
    }
};