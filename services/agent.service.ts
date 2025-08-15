
import { initialAgents, Agent } from '../agents';
import { AgentConfig } from '../agents/types';
import { produce } from 'immer';
import _ from 'lodash';

class AgentService {
  private agents: Agent[];

  constructor(agents: Agent[]) {
    this.agents = JSON.parse(JSON.stringify(agents)); 
  }

  getAgents(): Agent[] {
    return this.agents;
  }

  updateAgentConfig(agentId: string, newConfig: Partial<AgentConfig>) {
      this.agents = produce(this.agents, draft => {
          const agent = draft.find(a => a.id === agentId);
          if (agent) {
              // Use lodash.merge for a robust deep merge of the config.
              _.merge(agent.config, newConfig);
          }
      });
  }
}

export const agentService = new AgentService(initialAgents);
