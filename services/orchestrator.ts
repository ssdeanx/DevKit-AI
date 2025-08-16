import { Agent, defaultAgent } from "../agents";
import { geminiService } from "./gemini.service";
import { agentService } from "./agent.service";
import { Type } from "@google/genai";
import { cacheService } from "./cache.service";

class Orchestrator {
    async selectAgent(prompt: string): Promise<{ agent: Agent, reasoning: string }> {
        const availableAgents = agentService.getAgents();
        if (availableAgents.length === 1) {
            return { agent: availableAgents[0], reasoning: "Only one agent available." };
        }

        const cacheKey = `orchestrator::v2::${prompt}`;
        const cachedDecision = await cacheService.get<{ agent_name: string; reasoning: string }>(cacheKey);
        
        if (cachedDecision) {
            const foundAgent = availableAgents.find(agent => agent.name === cachedDecision.agent_name);
            if (foundAgent) {
                console.log(`Orchestrator selected from cache: ${foundAgent.name}. Reasoning: ${cachedDecision.reasoning}`);
                return { agent: foundAgent, reasoning: cachedDecision.reasoning };
            }
        }

        const systemInstruction = `You are an expert request router performing meta-cognition. Your goal is to select the best agent to handle a user's request.

Your process is two-step:
1.  **Analyze Intent**: First, classify the user's core intent. Is it information retrieval, code generation, UI control, creative writing, file generation, or something else?
2.  **Select Agent**: Based on the intent, select the most specialized agent from the list below.

You must respond with a JSON object that strictly follows this schema: {"reasoning": "A brief explanation of your choice, starting with the identified intent.", "agent_name": "The exact name of the best agent"}.

**Available agents:**
${availableAgents.map(a => `- ${a.name}: ${a.description}`).join('\n')}

---
**Advanced Routing Examples:**

User request: "I need a professional README for my new TypeScript project."
Your response: {"reasoning": "Intent: File Generation. The user explicitly asked for a README, so the ReadmeAgent is the perfect fit.", "agent_name": "ReadmeAgent"}

User request: "find out who won the latest F1 race and then write a short, triumphant paragraph about the winner."
Your response: {"reasoning": "Intent: Multi-step Information Processing. This requires finding information (ResearchAgent) and then rewriting it (RefinerAgent). This complex task is best handled by the PlannerAgent.", "agent_name": "PlannerAgent"}

User request: "navigate to the icon generator"
Your response: {"reasoning": "Intent: UI Control. The user wants to control the application's UI. The FunctionCallingAgent is designed for this.", "agent_name": "FunctionCallingAgent"}

User request: "What does this code do: function (a,b) { return a+b; }"
Your response: {"reasoning": "Intent: Code Explanation. This is a general development query about a piece of code, best handled by the ChatAgent.", "agent_name": "ChatAgent"}

User request: "hello, how are you today?"
Your response: {"reasoning": "Intent: General Conversation. This is a simple conversational query, which is the primary role of the ChatAgent.", "agent_name": "ChatAgent"}

User request: "list the top 5 sci-fi movies of all time as a JSON array"
Your response: {"reasoning": "Intent: Structured Data Generation. The user is asking for a list in a specific JSON format. The StructuredOutputAgent is designed for this.", "agent_name": "StructuredOutputAgent"}
---
`;

        try {
            console.log(`Orchestrator: Selecting agent for prompt: "${prompt}"`);
            const response = await geminiService.generateContent({
                contents: [{ parts: [{ text: `User request: "${prompt}"` }] }],
                config: {
                    systemInstruction,
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            reasoning: { type: Type.STRING, description: "A brief explanation for choosing the agent." },
                            agent_name: { type: Type.STRING, description: `One of the following: [${availableAgents.map(a => `"${a.name}"`).join(', ')}]` }
                        },
                        required: ["reasoning", "agent_name"]
                    }
                }
            });
            
            const result = JSON.parse(response.text);
            const chosenAgentName = result.agent_name;
            const reasoning = result.reasoning;
            const foundAgent = availableAgents.find(agent => agent.name === chosenAgentName);

            if (foundAgent) {
                await cacheService.set(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL
            }
            
            console.log(`Orchestrator selected: ${foundAgent?.name || 'default'}. Reasoning: ${reasoning}`);
            return { agent: foundAgent || defaultAgent, reasoning };

        } catch (error) {
            console.error("Error selecting agent, falling back to default:", error);
            return { agent: defaultAgent, reasoning: "Error during orchestration." };
        }
    }
}

export const orchestrator = new Orchestrator();