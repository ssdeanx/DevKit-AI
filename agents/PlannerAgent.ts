
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content, MediaResolution } from '@google/genai';

const getSystemInstruction = (agentService: any): string => {
    const availableAgents = agentService.getAgents()
        .filter((a: Agent) => !['PlannerAgent', 'MemoryAgent', 'ContextRetrievalAgent', 'MemoryConsolidationAgent'].includes(a.name));

    const agentDescriptions = availableAgents.map((a: Agent) => `- **${a.name}**: ${a.description}`).join('\n');
    const agentNames = availableAgents.map((a: Agent) => `"${a.name}"`);

    return `### PERSONA
You are a "Master Planner" AI, an expert in task decomposition and strategic planning. You use a "Graph of Thoughts" process to arrive at the optimal execution plan.

### TASK & GOAL
Your task is to create a JSON execution plan to address the user's complex, multi-step request. Your goal is to construct the most logical, efficient, and robust plan possible by modeling the problem as a directed graph of dependent tasks.

### THOUGHT PROCESS (Graph of Thoughts)
1.  **Deconstruct into Nodes:** Break the user's request into fundamental, atomic tasks. Each task is a "node" in your thought graph.
2.  **Identify Edges (Dependencies):** Determine the relationships between the tasks. Task B cannot start until Task A is complete, creating a directed edge A -> B.
3.  **Select Tools:** Assign the most specialized agent from the list below to each node.
4.  **Synthesize Plan:** Convert the final, optimal graph into a linear sequence of steps for execution.

### NEW CAPABILITY: CONTEXT OPTIMIZATION
If the user's request is complex and involves a large code context, your FIRST step should OFTEN be to use the \`ContextOptimizerAgent\`. This agent will read the user's query and the list of available files, and intelligently select only the most relevant files. This makes subsequent steps much more efficient and accurate.
- **Use Case:** User asks "Refactor the authentication flow," and many files are staged.
- **Your Plan (Step 1):** \`{ "step": 1, "agent": "ContextOptimizerAgent", "task": "Based on the user query 'Refactor the authentication flow', select the most relevant files from the provided context." }\`
- **Your Plan (Step 2):** \`{ "step": 2, "agent": "ChatAgent", "task": "Using the optimized file context from step 1, refactor the authentication flow." }\`

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
};

const getResponseSchema = (agentService: any) => {
    const availableAgents = agentService.getAgents()
        .filter((a: Agent) => !['PlannerAgent', 'MemoryAgent', 'ContextRetrievalAgent', 'MemoryConsolidationAgent'].includes(a.name));
    const agentNames = availableAgents.map((a: Agent) => a.name);

    return {
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
};


export const PlannerAgent: Agent = {
    id: 'planner-agent',
    name: 'PlannerAgent',
    description: 'Decomposes complex, multi-step tasks into a plan for other agents to execute.',
    config: {
        config: {
            // System instruction and schema are now dynamic and will be added in execute()
            temperature: 0.0,
            responseMimeType: "application/json",
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: -1,
            },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
        // Dynamic import to break circular dependency
        const { agentService } = await import('../services/agent.service');

        const systemInstruction = getSystemInstruction(agentService);
        const responseSchema = getResponseSchema(agentService);
        
        const dynamicConfig = {
            ...this.config,
            config: {
                ...this.config.config,
                systemInstruction,
                responseSchema,
            }
        };

        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...dynamicConfig,
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
        
        yield { type: 'content', content: fullContent, agentName: this.name };
    }
};
