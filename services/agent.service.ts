
import { initialAgents, Agent } from '../agents';
import { AgentConfig } from '../agents/types';
import { produce } from 'immer';
import _ from 'lodash';

class AgentService {
  private agents: Agent[];

  constructor(agents: Agent[]) {
    // FIX: JSON.parse(JSON.stringify(...)) strips all functions from objects.
    // The new approach preserves the agent objects and their methods.
    this.agents = agents; 
  }

  getAgents(): Agent[] {
    return this.agents;
  }

  updateAgentConfig(agentId: string, newConfig: Partial<AgentConfig>) {
      // Immer's produce function creates a new, updated array, ensuring immutability.
      this.agents = produce(this.agents, draft => {
          const agent = draft.find(a => a.id === agentId);
          if (agent) {
              console.log(`Updating config for agent: ${agent.name}`, newConfig);
              // Use lodash.merge for a robust deep merge of the config.
              _.merge(agent.config, newConfig);
          }
      });
  }
}

export const agentService = new AgentService(initialAgents);