import { orchestrator } from './orchestrator';
import { Agent, AgentExecuteStream, WorkflowPlan } from '../agents/types';
import { agentService } from './agent.service';
import { FileNode, StagedFile, githubService } from './github.service';
import { ViewName, WorkflowStep } from '../App';
import { FunctionCall, Part, Type, Content } from '@google/genai';
import { PlannerAgent } from '../agents/PlannerAgent';
import { agentMemoryService } from './agent-memory.service';
import { cleanText } from '../lib/text';
import { shortTermMemoryService } from './short-term-memory.service';
import { MemoryAgent } from '../agents/MemoryAgent';

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

  private async *executePlan(
    planner: Agent,
    contents: Content[],
    callbacks: { setActiveView: (view: ViewName) => void; },
    baseContextParts: Part[],
    originalUserPrompt: string,
  ): AgentExecuteStream {
    // Step 1: Get the plan from the PlannerAgent
    console.log("Supervisor (Plan): Requesting plan from PlannerAgent.");
    const planStream = planner.execute(contents);
    let planJsonString = '';
    for await (const chunk of planStream) {
        if (chunk.type === 'content') {
            planJsonString += chunk.content.replace(/```json|```/g, '').trim();
        }
        // Yield thoughts from the planner
        yield { ...chunk, agentName: planner.name };
    }

    let parsedPlan: WorkflowPlan;
    try {
        parsedPlan = JSON.parse(planJsonString);
        if (!parsedPlan.plan || !Array.isArray(parsedPlan.plan)) {
            throw new Error("Invalid plan structure");
        }
         console.log("Supervisor (Plan): Parsed plan successfully:", parsedPlan.plan);
    } catch (e) {
        console.error("Supervisor (Plan): Failed to parse plan JSON. Raw string:", planJsonString, "Error:", e);
        yield { type: 'content', content: "I couldn't create a valid plan. Please try rephrasing your request." };
        return;
    }
    
    const allAgents = agentService.getAgents();
    let executionContext = ''; // This will hold the output of the previous step
    const workflowSteps: WorkflowStep[] = parsedPlan.plan.map(p => ({ ...p, status: 'pending' }));
    
    // Step 2: Execute the plan
    for (const step of parsedPlan.plan) {
        let stepSucceeded = true;
        let stepOutput = '';
        
        console.log(`Supervisor (Plan): Executing step ${step.step}: Agent: ${step.agent}, Task: "${step.task}"`);
        const currentStepIndex = workflowSteps.findIndex(ws => ws.step === step.step);
        workflowSteps[currentStepIndex].status = 'in-progress';
        yield { type: 'workflowUpdate', plan: [...workflowSteps] };

        const agentToExecute = allAgents.find(a => a.name === step.agent);
        if (!agentToExecute) {
            console.error(`Supervisor (Plan): Agent ${step.agent} not found in plan.`);
            stepOutput = `\nError: Agent ${step.agent} not found. Skipping step.`;
            stepSucceeded = false;
        } else {
            const subAgentPromptText = `<PLAN_CONTEXT>
You are one step in a multi-agent plan to address a user's request. Your work is crucial for the success of the overall plan.
<ORIGINAL_USER_REQUEST>
${originalUserPrompt}
</ORIGINAL_USER_REQUEST>
<CURRENT_TASK>
Your current task is: "${step.task}"
</CURRENT_TASK>
${executionContext ? `<PREVIOUS_STEP_OUTPUT>
The output from the previous step is provided below. Use it to inform your work.
${executionContext}
</PREVIOUS_STEP_OUTPUT>` : '<INFO>This is the first step, so there is no previous context.</INFO>'}
</PLAN_CONTEXT>
Please perform your task and provide the output.`;
            
            const subAgentPromptParts: Part[] = [...baseContextParts, { text: subAgentPromptText }];
            const subAgentContents: Content[] = [{ role: 'user', parts: subAgentPromptParts }];

            try {
                const agentStream = this.executeAgentWithFunctionCalling(agentToExecute, subAgentContents, callbacks);
                for await (const chunk of agentStream) {
                    yield { ...chunk, agentName: agentToExecute.name };
                    if (chunk.type === 'content') {
                        stepOutput += chunk.content;
                    }
                }
            } catch (error: any) {
                console.error(`Supervisor (Plan): Error executing agent ${agentToExecute.name} for step ${step.step}. Error: ${error.message}`);
                stepOutput = `Error during execution of ${agentToExecute.name}: ${error.message}`;
                stepSucceeded = false;
            }
        }
        
        // Update context for the next step
        if (stepSucceeded) {
            executionContext = `\n--- Output from Step ${step.step} (${agentToExecute?.name}) ---\n${stepOutput}`;
        } else {
            executionContext = `\n--- FAILED: Output from Step ${step.step} (${agentToExecute?.name}) ---\n${stepOutput}`;
        }

        workflowSteps[currentStepIndex].status = 'completed'; // Mark as completed even if failed, to move to next step.
        workflowSteps[currentStepIndex].output = stepOutput;
        console.log(`Supervisor (Plan): Step ${step.step} finished.`);
    }

     yield { type: 'workflowUpdate', plan: [...workflowSteps] };
  }

  private async *executeAgentWithFunctionCalling(
    agent: Agent,
    contents: Content[],
    callbacks: { setActiveView: (view: ViewName) => void; }
  ): AgentExecuteStream {
    
    const history: Content[] = structuredClone(contents);
    const MAX_TURNS = 10;
    let currentTurn = 0;

    while (currentTurn < MAX_TURNS) {
        currentTurn++;
        console.log(`Supervisor (FC): Turn ${currentTurn} for agent ${agent.name}.`);
        
        const stream = agent.execute(history);
        let functionCall: FunctionCall | null = null;
        let hasContent = false;

        for await (const chunk of stream) {
            if (chunk.type === 'content' && chunk.content) hasContent = true;
            if (chunk.type === 'functionCall' && chunk.functionCall) {
                functionCall = chunk.functionCall;
            }
            // Pass all chunks through to the UI
            yield chunk;
        }
        
        if (functionCall) {
            const toolName = functionCall.name;
            const tool = availableTools[toolName];
            let result;

            if (tool) {
                result = await tool(functionCall.args, callbacks, this.apiKey); // Pass apiKey to tool
                console.log(`Supervisor (FC): Tool ${toolName} executed with result:`, result);
            } else {
                result = { error: `Tool ${toolName} not found.` };
                console.error(`Supervisor (FC): Tool ${toolName} not found.`);
            }
            
            // Add the tool call and its result to the history for the next turn
            history.push({ role: 'model', parts: [{ functionCall }] });
            history.push({ role: 'tool', parts: [{ functionResponse: { name: toolName, response: result } }] });

        } else {
             console.log(`Supervisor (FC): No more function calls for ${agent.name}. Ending loop.`);
            break;
        }
    }
     if (currentTurn >= MAX_TURNS) {
        console.error("Supervisor (FC): Function calling loop reached max turns. Breaking.");
        yield { type: 'content', content: "Sorry, I seem to be stuck in a loop. Please try rephrasing your request.", agentName: agent.name };
    }
  }

  async recordFeedback(messageId: string, rating: 'positive' | 'negative', reason: string | null, agentName?: string) {
    if (!agentName) {
        console.warn("Supervisor: Cannot record feedback without an agent name.");
        return;
    }
    const agent = agentService.getAgents().find(a => a.name === agentName);
    if (!agent) {
        console.error(`Supervisor: Agent ${agentName} not found for recording feedback.`);
        return;
    }

    if (rating === 'negative' && reason) {
        const feedbackMemory = `My previous response was rated negatively.
User Feedback: "${reason}".
I must learn from this. I will analyze the feedback and ensure my next response is improved and does not repeat the same mistake.`;
        
        await agentMemoryService.addMemory(agent.id, {
            content: feedbackMemory,
            type: 'feedback',
        });
        console.log(`Supervisor: Negative feedback recorded as a memory for ${agent.name}.`);
    } else {
        console.log(`Supervisor: Positive feedback recorded for ${agent.name}.`);
    }
  }
  
  private async _isMemoryNovel(agentId: string, potentialMemory: string): Promise<boolean> {
      const relevantMemories = await agentMemoryService.searchMemories(agentId, potentialMemory, 5);
      if (relevantMemories.length === 0) {
          return true; // No existing memories, so it's definitely novel.
      }

      const noveltyCheckPrompt = `[COMMAND: CHECK_NOVELTY]
### Task
Analyze the "New Potential Memory" and compare it against the "Existing Memories". Determine if the new memory adds significant, new information or if it is mostly redundant or a minor variation of what is already known.

### New Potential Memory
"${potentialMemory}"

### Existing Memories
${relevantMemories.map(m => `- ${m.content}`).join('\n')}

### Your Response
You MUST respond with a single, valid JSON object with the key "isNovel" (boolean) and an optional "reason" (string).
`;
      try {
          const memoryAgent = agentService.getAgents().find(a => a.id === MemoryAgent.id)!;
          const contents: Content[] = [{ role: 'user', parts: [{ text: noveltyCheckPrompt }] }];
          const stream = memoryAgent.execute(contents);
          let responseJson = '';
          for await (const chunk of stream) {
              if (chunk.type === 'content') responseJson += chunk.content;
          }
          const result = JSON.parse(responseJson.replace(/```json|```/g, '').trim());
          console.log(`Supervisor (Novelty Check): AI determined memory is ${result.isNovel ? 'NOVEL' : 'NOT NOVEL'}. Reason: ${result.reason}`);
          return result.isNovel;
      } catch (error) {
          console.error("Supervisor (Novelty Check): Failed to determine memory novelty via AI. Defaulting to true.", error);
          return true; // Fail safe: if the check fails, assume it's novel to avoid losing potentially good memories.
      }
  }

  async commitSessionToLongTermMemory(agentId: string) {
    const recentHistory = shortTermMemoryService.getHistory(10);
    if (recentHistory.length < 2) return; 

    const agent = agentService.getAgents().find(a => a.id === agentId);
    if (!agent) return;

    const canLearn = ['ChatAgent', 'ResearchAgent', 'CodeExecutionAgent', 'RefinerAgent'].includes(agent.name);
    if (!canLearn) return;

    console.log(`Supervisor: Starting LTM commit process for ${agent.name}.`);
    
    const conversation = recentHistory.map(entry => `[${entry.author}]: ${entry.content}`).join('\n\n');
    const summarizationPrompt = `[COMMAND: SUMMARIZE]
### Task
Analyze the following conversation history. Extract a single, concise, and important fact, user preference, or key takeaway that I (the AI) should remember for future interactions. The memory should be a statement from my perspective.

### Conversation History
---
${conversation}
---

### Your Response
You MUST respond with a single, valid JSON object with the key "summary" (string). If no significant new information was learned, return a summary that is null.`;
    
    try {
        const memoryAgent = agentService.getAgents().find(a => a.id === MemoryAgent.id)!;
        const contents: Content[] = [{ role: 'user', parts: [{ text: summarizationPrompt }] }];
        const stream = memoryAgent.execute(contents);
        let summaryJson = '';
        for await (const chunk of stream) {
            if (chunk.type === 'content') summaryJson += chunk.content;
        }
        
        const result = JSON.parse(summaryJson.replace(/```json|```/g, '').trim());
        const summary = result.summary;

        if (summary && summary.length > 20) {
            console.log(`Supervisor (LTM): Generated potential memory: "${summary}"`);
            const isNovel = await this._isMemoryNovel(agent.id, summary);
            if(isNovel) {
                await agentMemoryService.addMemory(agent.id, {
                    content: cleanText(summary),
                    type: 'self-generated',
                });
                console.log(`Supervisor (LTM): Committed new NOVEL memory for ${agent.name}.`);
            } else {
                 console.log(`Supervisor (LTM): Discarded redundant memory for ${agent.name}.`);
            }
        } else {
            console.log(`Supervisor (LTM): Commit for ${agent.name} skipped (summary too short or empty).`);
        }
    } catch (error) {
        console.error("Supervisor (LTM): Failed to commit session to LTM.", error);
    }
  }
}

export const supervisor = new Supervisor();