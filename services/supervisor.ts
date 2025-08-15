import { orchestrator } from './orchestrator';
import { Agent, AgentExecuteStream, WorkflowPlan } from '../agents/types';
import { agentService } from './agent.service';
import { FileNode } from './github.service';
import { ViewName, WorkflowStep } from '../App';
import { FunctionCall, Part } from '@google/genai';
import { PlannerAgent } from '../agents/PlannerAgent';

const feedbackLog: any[] = [];

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
    }
};

class Supervisor {
  async handleRequest(
    prompt: string,
    githubContext: FileNode[] | null,
    callbacks: { setActiveView: (view: ViewName) => void },
    forceAgentId?: string,
  ): Promise<{ agent: Agent; stream: AgentExecuteStream }> {
    
    let selectedAgent: Agent;
    if (forceAgentId) {
      const foundAgent = agentService.getAgents().find(a => a.id === forceAgentId);
      if (!foundAgent) {
        throw new Error(`Forced agent with ID ${forceAgentId} not found.`);
      }
      selectedAgent = foundAgent;
      console.log(`Supervisor: Agent execution forced to ${selectedAgent.name}`);
    } else {
      const orchestratorResult = await orchestrator.selectAgent(prompt);
      selectedAgent = orchestratorResult.agent;
      console.log(`Supervisor: Orchestrator selected agent ${selectedAgent.name}. Reasoning: ${orchestratorResult.reasoning}`);
    }

    let fullPrompt: string | Part[] = prompt;
    if (selectedAgent.acceptsContext && githubContext && githubContext.length > 0) {
      console.log(`Supervisor: Adding GitHub context for agent ${selectedAgent.name}.`);
      const contextString = `For context, the user has a GitHub repository loaded with the following file structure. Use this to inform your response:\n\`\`\`\n${formatFileTree(githubContext)}\`\`\`\n\nBased on that context, please handle the following user request:`;
      fullPrompt = [{text: contextString}, {text: prompt}];
    }
    
    if (selectedAgent.id === PlannerAgent.id) {
        console.log(`Supervisor: Executing multi-step plan with ${selectedAgent.name}.`);
        const stream = this.executePlan(selectedAgent, fullPrompt, callbacks);
        return { agent: selectedAgent, stream };
    } else {
        console.log(`Supervisor: Executing single agent ${selectedAgent.name} with function calling.`);
        const stream = this.executeAgentWithFunctionCalling(selectedAgent, fullPrompt, callbacks);
        return { agent: selectedAgent, stream };
    }
  }

  private async *executePlan(
    planner: Agent,
    prompt: string | Part[],
    callbacks: { setActiveView: (view: ViewName) => void; }
  ): AgentExecuteStream {
    // Step 1: Get the plan from the PlannerAgent
    console.log("Supervisor (Plan): Requesting plan from PlannerAgent.");
    const planStream = planner.execute(prompt);
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
        console.log(`Supervisor (Plan): Executing step ${step.step}: Agent: ${step.agent}, Task: "${step.task}"`);
        // Update UI with the current plan state
        const currentStepIndex = workflowSteps.findIndex(ws => ws.step === step.step);
        workflowSteps[currentStepIndex].status = 'in-progress';
        yield { type: 'workflowUpdate', plan: [...workflowSteps] };

        const agentToExecute = allAgents.find(a => a.name === step.agent);
        if (!agentToExecute) {
            console.error(`Supervisor (Plan): Agent ${step.agent} not found in plan.`);
            executionContext += `\nError: Agent ${step.agent} not found.`;
            continue;
        }

        // Construct the prompt for the sub-agent
        const subAgentPrompt = `
        You are one step in a multi-agent plan.
        Previous context from other agents:
        ---
        ${executionContext || 'No previous context.'}
        ---
        Your specific task is: "${step.task}"
        Please perform this task and provide the output.
        `;

        const agentStream = this.executeAgentWithFunctionCalling(agentToExecute, subAgentPrompt, callbacks);
        let stepOutput = '';

        for await (const chunk of agentStream) {
            // Pass through chunks from sub-agents, but mark them with the correct agent name
            yield { ...chunk, agentName: agentToExecute.name };
            if (chunk.type === 'content') {
                stepOutput += chunk.content;
            }
        }

        executionContext += `\n\n--- Output from ${agentToExecute.name} ---\n${stepOutput}`;
        workflowSteps[currentStepIndex].status = 'completed';
        workflowSteps[currentStepIndex].output = stepOutput;
         console.log(`Supervisor (Plan): Step ${step.step} completed.`);
    }

     yield { type: 'workflowUpdate', plan: [...workflowSteps] };
  }

  private async *executeAgentWithFunctionCalling(
    agent: Agent,
    prompt: string | Part[],
    callbacks: { setActiveView: (view: ViewName) => void; }
  ): AgentExecuteStream {
    
    const history: Part[] = Array.isArray(prompt) ? prompt : [{text: prompt}];
    const MAX_TURNS = 10;
    let currentTurn = 0;

    while (currentTurn < MAX_TURNS) {
        currentTurn++;
        console.log(`Supervisor (FC): Turn ${currentTurn} for agent ${agent.name}.`);
        
        const stream = agent.execute(history, history);
        let functionCall: FunctionCall | null = null;

        for await (const chunk of stream) {
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
                result = tool(functionCall.args, callbacks);
                console.log(`Supervisor (FC): Tool ${toolName} executed with result:`, result);
            } else {
                result = { error: `Tool ${toolName} not found.` };
                console.error(`Supervisor (FC): Tool ${toolName} not found.`);
            }
            
            // Add the function call and its result to history for the next turn.
            // The agent's `execute` method is expected to handle the full history.
            history.push({ functionCall });
            history.push({ functionResponse: { name: toolName, response: result } });

        } else {
            // No more function calls, we are done.
             console.log(`Supervisor (FC): No more function calls for ${agent.name}. Ending loop.`);
            break;
        }
    }
     if (currentTurn >= MAX_TURNS) {
        console.error("Supervisor (FC): Function calling loop reached max turns. Breaking.");
        yield { type: 'content', content: "Sorry, I seem to be stuck in a loop. Please try rephrasing your request.", agentName: agent.name };
    }
  }

  recordFeedback(messageId: string, rating: 'positive' | 'negative', reason: string | null, agentName?: string) {
    const feedback = {
        timestamp: new Date().toISOString(),
        messageId,
        agentName,
        feedback: rating,
        reason,
    };
    feedbackLog.push(feedback);
    console.log(`Feedback recorded:`, feedback);
  }
}

export const supervisor = new Supervisor();