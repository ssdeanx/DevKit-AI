
import { Agent, defaultAgent } from "../agents";
import { geminiService } from "./gemini.service";
import { agentService } from "./agent.service";
import { Type } from "@google/genai";

class Orchestrator {
    async selectAgent(prompt: string): Promise<{ agent: Agent, reasoning: string }> {
        const availableAgents = agentService.getAgents();
        if (availableAgents.length === 1) {
            return { agent: availableAgents[0], reasoning: "Only one agent available." };
        }

        const systemInstruction = `You are an expert request router. Your job is to select the best agent to handle a user's request based on the agent's description.
You must respond with a JSON object that strictly follows this schema: {"reasoning": "A brief explanation of your choice.", "agent_name": "The exact name of the best agent"}.

Available agents:
${availableAgents.map(a => `- ${a.name}: ${a.description}`).join('\n')}

---
Here are some examples of how to route requests:

User request: "I need a professional README for my new TypeScript project."
Your response: {"reasoning": "The user explicitly asked for a README, so the ReadmeAgent is the best fit.", "agent_name": "ReadmeAgent"}

User request: "What's the weather like in London?"
Your response: {"reasoning": "This is a question about real-world, up-to-date information, which requires a web search. The ResearchAgent is designed for this.", "agent_name": "ResearchAgent"}

User request: "Can you make this paragraph sound more formal?"
Your response: {"reasoning": "The user wants to improve existing text, which is the specific purpose of the RefinerAgent.", "agent_name": "RefinerAgent"}

User request: "navigate to the icon generator"
Your response: {"reasoning": "The user wants to control the application's UI to navigate. The ToolAgent is designed for this.", "agent_name": "ToolAgent"}

User request: "change the readme agent temp to 0.5"
Your response: {"reasoning": "The user wants to modify an agent's setting, which is a function call handled by the ToolAgent.", "agent_name": "ToolAgent"}

User request: "what does this code do: function (a,b) { return a+b; }"
Your response: {"reasoning": "The user is asking a question about a piece of code, which is a general development query for the ChatAgent.", "agent_name": "ChatAgent"}

User request: "hello, how are you today?"
Your response: {"reasoning": "This is a general conversational query, best handled by the default ChatAgent.", "agent_name": "ChatAgent"}
---
`;

        try {
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
            
            console.log(`Orchestrator selected: ${foundAgent?.name || 'default'}. Reasoning: ${reasoning}`);
            return { agent: foundAgent || defaultAgent, reasoning };

        } catch (error) {
            console.error("Error selecting agent, falling back to default:", error);
            return { agent: defaultAgent, reasoning: "Error during orchestration." };
        }
    }
}

export const orchestrator = new Orchestrator();
