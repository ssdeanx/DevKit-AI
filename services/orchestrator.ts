

import { Agent, defaultAgent } from "../agents";
import { geminiService } from "./gemini.service";
import { agentService } from "./agent.service";
import { Type } from "@google/genai";
import { cacheService } from "./cache.service";
import { agentPerformanceService } from "./agent-performance.service";
import { FileNode, StagedFile } from "./github.service";

interface FullGitContext {
    repoUrl: string;
    fileTree: FileNode[] | null;
    stagedFiles: StagedFile[];
}

class Orchestrator {
    async selectAgent(prompt: string, githubContext: FullGitContext): Promise<{ agent: Agent, reasoning: string }> {
        const availableAgents = agentService.getAgents();
        if (availableAgents.length === 1) {
            return { agent: availableAgents[0], reasoning: "Only one agent available." };
        }

        const cacheKey = `orchestrator::v4::${prompt}::context:${githubContext.repoUrl}-${githubContext.stagedFiles.length}`;
        const cachedDecision = await cacheService.get<{ agent_name: string; reasoning: string }>(cacheKey);
        
        if (cachedDecision) {
            const foundAgent = availableAgents.find(agent => agent.name === cachedDecision.agent_name);
            if (foundAgent) {
                console.log(`Orchestrator selected from cache: ${foundAgent.name}. Reasoning: ${cachedDecision.reasoning}`);
                return { agent: foundAgent, reasoning: cachedDecision.reasoning };
            }
        }

        const agentPerformance = await Promise.all(
            availableAgents.map(async (agent) => {
                const perf = await agentPerformanceService.getAveragePerformance(agent.id);
                return { name: agent.name, perf };
            })
        );

        const performanceSummary = agentPerformance
            .filter(p => p.perf !== null && p.perf.runCount > 0)
            .map(p => `- **${p.name}**: Avg Score: ${p.perf!.avgFinalScore.toFixed(2)} (${p.perf!.runCount} runs)`)
            .join('\n');

        let performanceContext = '';
        if (performanceSummary) {
            performanceContext = `
**Historical Agent Performance (Score: 0.1-1.2, higher is better):**
This data shows how effectively and efficiently agents have performed on past tasks. The score incorporates token efficiency, heuristic quality checks, and direct user feedback. Use this as a significant factor in your decision.
${performanceSummary}
`;
        }

        let contextSummary = 'Context: No specific project context is available.';
        if (githubContext.repoUrl) {
            const repoName = githubContext.repoUrl.split('/').slice(-2).join('/');
            if (githubContext.stagedFiles.length > 0) {
                contextSummary = `Context: The user is working in the '${repoName}' repository and has staged ${githubContext.stagedFiles.length} file(s). This suggests a task related to code analysis, generation, or modification.`;
            } else {
                contextSummary = `Context: The user has loaded the '${repoName}' repository but has not staged any specific files. The task might be about the project as a whole.`;
            }
        }

        const systemInstruction = `You are an expert request router performing meta-cognition. Your goal is to select the best agent to handle a user's request from the provided list.

Your process is a strict two-step Chain-of-Thought:
1.  **Analyze Intent & Context**: First, classify the user's core intent based on their request and the provided application context. Is it code analysis, file generation, UI control, web research, text refinement, planning a multi-step task, or general conversation?
2.  **Select Agent**: Based on the identified intent, application context, and historical performance data, select the single most specialized and effective agent from the list below. Your selection must be precise.

You must respond with a JSON object that strictly follows this schema: {"reasoning": "A brief explanation of your choice, starting with the identified intent and referencing context/performance if they were factors.", "agent_name": "The exact name of the best agent"}.

${performanceContext}

**Available agents:**
${availableAgents.map(a => `- **${a.name}**: ${a.description}`).join('\n')}

---
**Few-Shot Routing Examples:**

Context: The user is working in the 'DevKit-AI' repository and has staged 3 file(s).
User request: "I need a professional README for my new TypeScript project."
Your response: {"reasoning": "Intent: File Generation. The user explicitly asked for a README and has project context loaded, so the ReadmeAgent is the perfect fit.", "agent_name": "ReadmeAgent"}

Context: No specific project context is available.
User request: "find out who won the latest F1 race and then write a short, triumphant paragraph about the winner."
Your response: {"reasoning": "Intent: Multi-step Information Processing. This requires finding information (ResearchAgent) and then rewriting it (RefinerAgent). This complex task is best handled by the PlannerAgent.", "agent_name": "PlannerAgent"}

Context: No specific project context is available.
User request: "navigate to the icon generator"
Your response: {"reasoning": "Intent: UI Control. The user wants to control the application's UI. The FunctionCallingAgent is designed for this.", "agent_name": "FunctionCallingAgent"}
---
`;

        try {
            console.log(`Orchestrator: Selecting agent for prompt: "${prompt}" with context: ${contextSummary}`);
            const response = await geminiService.generateContent({
                contents: [{ parts: [{ text: `**Application Context:** ${contextSummary}\n\n**User request:** "${prompt}"` }] }],
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