
import { orchestrator } from './orchestrator';
import { Agent, AgentExecuteStream } from '../agents/types';
import { agentService } from './agent.service';
import { FileNode } from './github.service';
import { ViewName } from '../App';
import { FunctionCall, Part } from '@google/genai';

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
    } else {
      const orchestratorResult = await orchestrator.selectAgent(prompt);
      selectedAgent = orchestratorResult.agent;
      console.log(`Orchestrator Reasoning: ${orchestratorResult.reasoning}`);
    }

    let fullPrompt: string | Part[] = prompt;
    if (selectedAgent.acceptsContext && githubContext && githubContext.length > 0) {
      const contextString = `For context, the user has a GitHub repository loaded with the following file structure. Use this to inform your response:\n\`\`\`\n${formatFileTree(githubContext)}\`\`\`\n\nBased on that context, please handle the following user request:`;
      fullPrompt = [{text: contextString}, {text: prompt}];
    }

    const stream = this.executeAgentWithFunctionCalling(selectedAgent, fullPrompt, callbacks);
    
    return { agent: selectedAgent, stream };
  }

  private async *executeAgentWithFunctionCalling(
    agent: Agent,
    prompt: string | Part[],
    callbacks: { setActiveView: (view: ViewName) => void; }
  ): AgentExecuteStream {
    
    let history: Part[] = Array.isArray(prompt) ? prompt : [{ text: prompt }];
    const MAX_TURNS = 5; // Safety break to prevent infinite loops
    let currentTurn = 0;

    while (currentTurn < MAX_TURNS) {
        currentTurn++;
        
        const agentStream = agent.execute(history);
        let functionCall: FunctionCall | null = null;
        let hasYielded = false;

        for await (const chunk of agentStream) {
            if (chunk.type === 'functionCall' && chunk.functionCall.name) {
                functionCall = chunk.functionCall;
                yield { type: 'functionCall', functionCall: chunk.functionCall };
                hasYielded = true;
            } else {
                yield chunk;
                hasYielded = true;
            }
        }
        
        if (functionCall) {
            const toolName = functionCall.name;
            const tool = availableTools[toolName];
            let result;

            if (tool) {
                result = tool(functionCall.args, callbacks);
                console.log(`Tool ${toolName} executed with result:`, result);
            } else {
                result = { error: `Tool ${toolName} not found.` };
                console.error(`Tool ${toolName} not found.`);
            }

            // Prepare for the next turn in the loop
            const functionResponsePart: Part = { functionResponse: { name: toolName, response: result } };
            history = [functionResponsePart];
        } else {
            // No more function calls, we are done.
            if (!hasYielded && history.length > 0 && currentTurn === 1) {
              // This handles non-streaming agents that need a single yield
              const finalContent = history.map(p => (p as any).text || '').join('\n');
              yield { type: 'content', content: finalContent };
            }
            break;
        }
    }
     if (currentTurn >= MAX_TURNS) {
        console.error("Function calling loop reached max turns. Breaking.");
        yield { type: 'content', content: "Sorry, I seem to be stuck in a loop. Please try rephrasing your request." };
    }
  }

  recordFeedback(messageId: string, rating: 'positive' | 'negative') {
    const feedback = {
        timestamp: new Date().toISOString(),
        messageId,
        feedback: rating,
    };
    feedbackLog.push(feedback);
    console.log(`Feedback recorded:`, feedback);
  }
}

export const supervisor = new Supervisor();
