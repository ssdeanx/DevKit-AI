

import { orchestrator } from './orchestrator';
import { Agent, AgentExecuteStream, WorkflowPlan, TokenUsage } from '../agents/types';
import { agentService } from './agent.service';
import { FileNode, StagedFile, githubService } from './github.service';
import { ViewName, WorkflowStep } from '../App';
import { FunctionCall, Part, Type, Content } from '@google/genai';
import { PlannerAgent } from '../agents/PlannerAgent';
import { agentMemoryService } from './agent-memory.service';
import { cleanText } from '../lib/text';
import { shortTermMemoryService } from './short-term-memory.service';
import { MemoryAgent } from '../agents/MemoryAgent';
import { agentPerformanceService } from './agent-performance.service';
import { v4 as uuidv4 } from 'uuid';

interface FullGitContext {
    fileTree: FileNode[] | null;
    stagedFiles: StagedFile[];
}

interface RetryContext {
    originalPrompt: string;
    feedback: string;
}

const formatFileTree = (nodes: FileNode[], indent = 0): string => {
  let result = '';
  for (const node of nodes) {
    result += `${'  '.repeat(indent)}- ${node.name}\n`;
    if (node.children) {
      result += formatFileTree(node.children, indent + 1);
    }
  }
  return result;
};

const availableTools: { [key: string]: Function } = {
    navigateToView: (args: { viewName: ViewName }, callbacks: { setActiveView: (view: ViewName) => void; }) => {
        console.log(`Executing navigateToView with args:`, args);
        if (args.viewName) {
            callbacks.setActiveView(args.viewName);
            return { success: true, message: `Navigated to ${args.viewName}.` };
        }
        return { success: false, message: "Invalid view name provided." };
    },
    updateAgentSetting: (args: { agentName: string; parameter: string; value: any; }) => {
        console.log(`Executing updateAgentSetting with args:`, args);
        const agent = agentService.getAgents().find(a => a.name === args.agentName);
        if (agent) {
            agentService.updateAgentConfig(agent.id, { config: { [args.parameter]: args.value } });
            return { success: true, message: `Updated ${args.agentName}'s ${args.parameter} to ${args.value}.` };
        }
        return { success: false, message: `Agent ${args.agentName} not found.` };
    },
    searchGithubCode: async (args: { query: string }, _callbacks: any, apiKey: string) => {
        console.log(`Executing searchGithubCode with args:`, args);
        if (!apiKey) {
            return { success: false, message: "Error: A GitHub API key is required for this operation. Please add one in the GitHub Inspector view." };
        }
        try {
            const results = await githubService.searchCode(args.query, apiKey);
             if (results.length === 0) {
                return { success: true, results: "No code results found for the query." };
            }
            // Fetch content for top 2 results for more context
            const detailedResults = await Promise.all(results.slice(0, 2).map(async result => {
                const content = await githubService.fetchFileContent(`https://github.com/${result.repo}`, result.path, apiKey);
                return { ...result, content: content.substring(0, 1000) }; // Truncate content
            }));
            return { success: true, results: detailedResults };
        } catch(e: any) {
            return { success: false, message: `Error searching code on GitHub: ${e.message}` };
        }
    },
    searchGithubIssues: async (args: { issueUrl: string }, _callbacks: any, apiKey: string) => {
         if (!apiKey) return { success: false, message: "Error: GitHub API key is required." };
         try {
            const details = await githubService.fetchIssueDetails(args.issueUrl, apiKey);
            const labels = await githubService.fetchRepoLabels(details.repo, apiKey);
            return { success: true, issue: details, availableLabels: labels };
         } catch(e: any) {
            return { success: false, message: `Error fetching issue details: ${e.message}` };
         }
    },
    setGithubIssueLabels: async (args: { issueUrl: string, labels: string[] }, _callbacks: any, apiKey: string) => {
        if (!apiKey) return { success: false, message: "Error: GitHub API key is required." };
        try {
            const result = await githubService.setIssueLabels(args.issueUrl, args.labels, apiKey);
            return result;
        } catch(e: any) {
            return { success: false, message: `Error setting issue labels: ${e.message}` };
        }
    }
};

class Supervisor {
  private apiKey: string = ''; // Hold apiKey for tool use

  async handleRequest(
    prompt: string,
    githubContext: FullGitContext & { apiKey?: string },
    callbacks: { setActiveView: (view: ViewName) => void },
    forceAgentId?: string,
    retryContext?: RetryContext,
    initialContents?: Content[]
  ): Promise<{ agent: Agent; stream: AgentExecuteStream }> {
    try {
        this.apiKey = githubContext.apiKey || ''; // Store apiKey for this request
        let selectedAgent: Agent;
        const effectivePrompt = retryContext ? retryContext.originalPrompt : prompt;

        if (forceAgentId) {
        const foundAgent = agentService.getAgents().find(a => a.id === forceAgentId);
        if (!foundAgent) {
            throw new Error(`Forced agent with ID ${forceAgentId} not found.`);
        }
        selectedAgent = foundAgent;
        console.log(`Supervisor: Agent execution forced to ${selectedAgent.name}`);
        } else {
        const orchestratorResult = await orchestrator.selectAgent(effectivePrompt);
        selectedAgent = orchestratorResult.agent;
        console.log(`Supervisor: Orchestrator selected agent ${selectedAgent.name}. Reasoning: ${orchestratorResult.reasoning}`);
        }

        let contextParts: Part[] = [];
        
        // 1. Add Short-Term Memory (current conversation)
        const recentHistory = shortTermMemoryService.getHistory(5); // Get last 5 turns
        if (recentHistory.length > 0) {
            let stmContext = `<CONVERSATION_HISTORY>
This is the recent history of our current conversation. Use it to understand the immediate context.
${recentHistory.map(entry => `[${entry.author === 'user' ? 'USER' : 'AI'}]: ${cleanText(entry.content)}`).join('\n')}
</CONVERSATION_HISTORY>`;
            contextParts.push({ text: stmContext });
        }

        // 2. Add Long-Term Memory (facts & feedback)
        const relevantMemories = await agentMemoryService.searchMemories(selectedAgent.id, effectivePrompt);
        if (relevantMemories.length > 0) {
            let ltmContext = `<LONG_TERM_MEMORY>
This is your personal memory of key facts and user feedback from past sessions. Use it to improve your performance and avoid past mistakes.
${relevantMemories.map(mem => `- [${mem.type.toUpperCase()}] ${mem.content}`).join('\n')}
</LONG_TERM_MEMORY>`;
            contextParts.push({ text: ltmContext });
        }

        // 3. Add retry context if it exists
        if (retryContext) {
            contextParts.push({ text: `<RETRY_CONTEXT>
CRITICAL: Your previous attempt to answer this failed. You are re-attempting the task based on direct user feedback.
[USER FEEDBACK]: "${retryContext.feedback}"
Analyze this feedback carefully to improve your response and avoid the previous error.
</RETRY_CONTEXT>` });
        }

        // 4. Add GitHub context
        if (selectedAgent.acceptsContext && (githubContext.fileTree || githubContext.stagedFiles.length > 0)) {
            console.log(`Supervisor: Adding GitHub context for agent ${selectedAgent.name}.`);
            let gitContextString = "<GITHUB_CONTEXT>\nThis is your primary source of truth for the user's project.\n\n";

            if (githubContext.fileTree && githubContext.fileTree.length > 0) {
                gitContextString += `<FILE_STRUCTURE>\n${formatFileTree(githubContext.fileTree)}\n</FILE_STRUCTURE>\n\n`;
            }
            
            if (githubContext.stagedFiles.length > 0) {
                gitContextString += "<STAGED_FILES>\n";
                for (const file of githubContext.stagedFiles) {
                    const cleanedContent = cleanText(file.content);
                    gitContextString += `<FILE path="${file.path}">\n${cleanedContent}\n</FILE>\n\n`;
                }
                gitContextString += "</STAGED_FILES>\n";
            }
            gitContextString += "</GITHUB_CONTEXT>";
            contextParts.push({ text: gitContextString });
        }

        const finalPromptParts: Part[] = [
            ...contextParts,
            { text: `Based on all the context provided, please handle the following user request:\n\n<USER_REQUEST>\n${effectivePrompt}\n</USER_REQUEST>` }
        ];
        
        const finalContents: Content[] = initialContents 
            ? initialContents
            : [{ role: 'user', parts: finalPromptParts }];

        if (selectedAgent.id === PlannerAgent.id) {
            console.log(`Supervisor: Executing multi-step plan with ${selectedAgent.name}.`);
            const stream = this.executePlan(selectedAgent, finalContents, callbacks, contextParts, effectivePrompt);
            return { agent: selectedAgent, stream };
        } else {
            console.log(`Supervisor: Executing single agent ${selectedAgent.name} with function calling.`);
            const stream = this.executeAgentWithFunctionCalling(selectedAgent, finalContents, callbacks);
            return { agent: selectedAgent, stream };
        }
    } catch(error) {
        console.error("Supervisor: A critical error occurred in handleRequest:", error);
        // This is a fallback for errors happening *before* streaming begins.
        // We create a dummy agent and a stream that yields a single error message.
        const dummyAgent = agentService.getAgents().find(a => a.id === 'chat-agent')!;
        const stream = async function* (): AgentExecuteStream {
            yield { type: 'content', content: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`, agentName: 'System' };
        }();
        return { agent: dummyAgent, stream };
    }
  }

  private _calculateEfficiencyScore(prompt: string, tokens: TokenUsage): number {
    const promptLength = prompt.length;
    const totalTokens = tokens.totalTokenCount ?? 0;

    if (totalTokens === 0) return 0.5;

    const efficiencyRatio = promptLength / totalTokens;
    const squashedRating = (Math.atan(efficiencyRatio - 1) / Math.PI) + 0.5;
    return Math.max(0.1, Math.min(1.0, squashedRating));
  }

  private _calculateQualityScore(output: string, agent: Agent): number {
    let score = 1.0;
    const lowerOutput = output.toLowerCase();

    // Penalize for common failure indicators
    if (lowerOutput.includes("error") || lowerOutput.includes("failed") || lowerOutput.includes("unable to")) {
        score *= 0.7;
    }
    if (output.length < 50 && (lowerOutput.includes("i can't") || lowerOutput.includes("i cannot"))) {
        score *= 0.4;
    }
    if (output.trim().length === 0) {
        return 0.1; // Very low score for empty output
    }

    // Check for format adherence if a schema is present
    if (agent.config.config?.responseMimeType === "application/json") {
        try {
            JSON.parse(output.replace(/```json|```/g, '').trim());
        } catch (e) {
            score = 0.1; // Drastic penalty for invalid JSON when JSON is expected
        }
    }

    return Math.max(0.1, score);
  }

  private async *executePlan(
    planner: Agent,
    contents: Content[],
    callbacks: { setActiveView: (view: ViewName) => void; },
    baseContextParts: Part[],
    originalUserPrompt: string,
  ): AgentExecuteStream {
    const runId = uuidv4();
    yield { type: 'runStart', runId, agentName: planner.name };

    const planStream = planner.execute(contents);
    let planJsonString = '';
    let plannerUsage: TokenUsage | null = null;
    let finalContent = '';
    
    for await (const chunk of planStream) {
        if (chunk.type === 'content') planJsonString += chunk.content.replace(/```json|```/g, '').trim();
        if (chunk.type === 'usageMetadata') plannerUsage = chunk.usage;
        yield chunk; // Pass through all chunks
    }

    if (plannerUsage) {
        const qualityScore = this._calculateQualityScore(planJsonString, planner);
        const efficiencyScore = this._calculateEfficiencyScore(originalUserPrompt, plannerUsage);
        agentPerformanceService.addRecord(planner.id, runId, originalUserPrompt, plannerUsage, efficiencyScore, qualityScore);
    }

    let parsedPlan: WorkflowPlan;
    try {
        parsedPlan = JSON.parse(planJsonString);
        if (!parsedPlan.plan || !Array.isArray(parsedPlan.plan)) throw new Error("Invalid plan structure");
        console.log("Supervisor (Plan): Parsed plan successfully:", parsedPlan.plan);
    } catch (e) {
        console.error("Supervisor (Plan): Failed to parse plan JSON.", e);
        yield { type: 'content', content: "I couldn't create a valid plan. Please try rephrasing your request." };
        return;
    }
    
    const allAgents = agentService.getAgents();
    let executionContext = '';
    const workflowSteps: WorkflowStep[] = parsedPlan.plan.map(p => ({ ...p, status: 'pending' }));
    
    for (const step of parsedPlan.plan) {
        const currentStepIndex = workflowSteps.findIndex(ws => ws.step === step.step);
        workflowSteps[currentStepIndex].status = 'in-progress';
        yield { type: 'workflowUpdate', plan: [...workflowSteps] };
        
        const agentToExecute = allAgents.find(a => a.name === step.agent);
        if (!agentToExecute) {
            const errorMsg = `\nError: Agent ${step.agent} not found. Skipping step.`;
            executionContext += errorMsg;
            workflowSteps[currentStepIndex].status = 'completed';
            workflowSteps[currentStepIndex].output = errorMsg;
        } else {
            const subAgentPromptText = `<PLAN_CONTEXT>...Your task is: "${step.task}"...${executionContext}</PLAN_CONTEXT>`;
            const subAgentContents: Content[] = [{ role: 'user', parts: [...baseContextParts, { text: subAgentPromptText }] }];
            
            let stepOutput = '';
            let stepUsage: TokenUsage = {};
            const stepRunId = uuidv4();

            const agentStream = this.executeAgentWithFunctionCalling(agentToExecute, subAgentContents, callbacks, stepRunId);
            for await (const chunk of agentStream) {
                if (chunk.type === 'content') stepOutput += chunk.content;
                if (chunk.type === 'usageMetadata') stepUsage = { ...stepUsage, ...chunk.usage };
                yield chunk;
            }
            
            executionContext += `\n--- Output from Step ${step.step} (${agentToExecute.name}) ---\n${stepOutput}`;
            workflowSteps[currentStepIndex].status = 'completed';
            workflowSteps[currentStepIndex].output = stepOutput;
            workflowSteps[currentStepIndex].usage = stepUsage;

            const qualityScore = this._calculateQualityScore(stepOutput, agentToExecute);
            const efficiencyScore = this._calculateEfficiencyScore(step.task, stepUsage);
            agentPerformanceService.addRecord(agentToExecute.id, stepRunId, step.task, stepUsage, efficiencyScore, qualityScore);
        }
        
        yield { type: 'workflowUpdate', plan: [...workflowSteps] };
    }
  }

  private async *executeAgentWithFunctionCalling(
    agent: Agent,
    contents: Content[],
    callbacks: { setActiveView: (view: ViewName) => void; },
    runId: string = uuidv4()
  ): AgentExecuteStream {
    yield { type: 'runStart', runId, agentName: agent.name };

    const history: Content[] = structuredClone(contents);
    const MAX_TURNS = 10;
    let currentTurn = 0;
    let aggregatedUsage: TokenUsage = {};
    let finalContent = '';
    
    while (currentTurn < MAX_TURNS) {
        currentTurn++;
        const stream = agent.execute(history);
        let functionCall: FunctionCall | null = null;

        for await (const chunk of stream) {
            yield chunk;
            if (chunk.type === 'content') finalContent += chunk.content;
            if (chunk.type === 'functionCall') functionCall = chunk.functionCall;
            if (chunk.type === 'usageMetadata' && chunk.usage) {
                aggregatedUsage.promptTokenCount = (aggregatedUsage.promptTokenCount ?? 0) + (chunk.usage.promptTokenCount ?? 0);
                aggregatedUsage.candidatesTokenCount = (aggregatedUsage.candidatesTokenCount ?? 0) + (chunk.usage.candidatesTokenCount ?? 0);
                aggregatedUsage.totalTokenCount = (aggregatedUsage.totalTokenCount ?? 0) + (chunk.usage.totalTokenCount ?? 0);
                aggregatedUsage.thoughtsTokenCount = (aggregatedUsage.thoughtsTokenCount ?? 0) + (chunk.usage.thoughtsTokenCount ?? 0);
            }
        }
        
        if (functionCall) {
            const tool = availableTools[functionCall.name];
            const result = tool ? await tool(functionCall.args, callbacks, this.apiKey) : { error: `Tool ${functionCall.name} not found.` };
            history.push({ role: 'model', parts: [{ functionCall }] });
            history.push({ role: 'tool', parts: [{ functionResponse: { name: functionCall.name, response: result } }] });
        } else {
            break;
        }
    }
    
    if (aggregatedUsage.totalTokenCount) {
        const originalPrompt = contents[0]?.parts.map(p => 'text' in p ? p.text : '').join('\n') || '';
        const qualityScore = this._calculateQualityScore(finalContent, agent);
        const efficiencyScore = this._calculateEfficiencyScore(originalPrompt, aggregatedUsage);
        agentPerformanceService.addRecord(agent.id, runId, originalPrompt, aggregatedUsage, efficiencyScore, qualityScore);
        yield { type: 'usageMetadata', usage: aggregatedUsage, agentName: agent.name };
    }

    if (currentTurn >= MAX_TURNS) {
        yield { type: 'content', content: "Sorry, I seem to be stuck in a loop. Please try rephrasing.", agentName: agent.name };
    }
  }

  async recordFeedbackForRun(runId: string, rating: 'positive' | 'negative', reason: string | null) {
      await agentPerformanceService.updateFeedback(runId, rating);
      const record = await agentPerformanceService.getRecord(runId);
      if (!record) return;

      if (rating === 'negative' && reason) {
          const feedbackMemory = `My previous response to prompt "${record.prompt}" was rated negatively. User Feedback: "${reason}". I must learn from this.`;
          await agentMemoryService.addMemory(record.agentId, { content: feedbackMemory, type: 'feedback' });
      }
  }
  
  private async _isMemoryNovel(agentId: string, potentialMemory: string): Promise<boolean> {
      const relevantMemories = await agentMemoryService.searchMemories(agentId, potentialMemory, 5);
      if (relevantMemories.length === 0) return true;

      const noveltyCheckPrompt = `[COMMAND: CHECK_NOVELTY]...`;
      try {
          const memoryAgent = agentService.getAgents().find(a => a.id === MemoryAgent.id)!;
          const stream = memoryAgent.execute([{ role: 'user', parts: [{ text: noveltyCheckPrompt }] }]);
          let responseJson = '';
          for await (const chunk of stream) if (chunk.type === 'content') responseJson += chunk.content;
          const result = JSON.parse(responseJson.replace(/```json|```/g, '').trim());
          return result.isNovel;
      } catch (error) {
          console.error("Supervisor (Novelty Check): Failed. Defaulting to true.", error);
          return true;
      }
  }

  async commitSessionToLongTermMemory(agentId: string) {
    const recentHistory = shortTermMemoryService.getHistory(10);
    if (recentHistory.length < 2) return; 

    const agent = agentService.getAgents().find(a => a.id === agentId);
    if (!agent || !['ChatAgent', 'ResearchAgent', 'CodeExecutionAgent', 'RefinerAgent'].includes(agent.name)) return;

    const conversation = recentHistory.map(entry => `[${entry.author}]: ${entry.content}`).join('\n\n');
    const summarizationPrompt = `[COMMAND: SUMMARIZE]...${conversation}...`;
    
    try {
        const memoryAgent = agentService.getAgents().find(a => a.id === MemoryAgent.id)!;
        const stream = memoryAgent.execute([{ role: 'user', parts: [{ text: summarizationPrompt }] }]);
        let summaryJson = '';
        for await (const chunk of stream) if (chunk.type === 'content') summaryJson += chunk.content;
        
        const result = JSON.parse(summaryJson.replace(/```json|```/g, '').trim());
        const summary = result.summary;

        if (summary && summary.length > 20 && await this._isMemoryNovel(agent.id, summary)) {
            await agentMemoryService.addMemory(agent.id, { content: cleanText(summary), type: 'self-generated' });
            console.log(`Supervisor (LTM): Committed new NOVEL memory for ${agent.name}.`);
        }
    } catch (error) {
        console.error("Supervisor (LTM): Failed to commit session to LTM.", error);
    }
  }
}

export const supervisor = new Supervisor();