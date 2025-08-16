

import { initialAgents, Agent } from '../agents';
import { AgentConfig } from '../agents/types';
import { produce } from 'immer';
import _ from 'lodash';

const AGENT_CONFIG_STORAGE_KEY = 'devkit-ai-pro-agent-configs';

class AgentService {
  private agents: Agent[];

  constructor(agents: Agent[]) {
    const savedConfigs = this.loadConfigs();
    // Use a map for efficient lookup
    const configMap = new Map(savedConfigs.map(c => [c.id, c.config]));

    this.agents = agents.map(agent => {
        if (configMap.has(agent.id)) {
            console.log(`Loading saved config for ${agent.name}`);
            // Deep merge saved config into default config to handle new properties
            const mergedConfig = _.merge({}, agent.config, configMap.get(agent.id));
            return { ...agent, config: mergedConfig };
        }
        return agent;
    });
  }

  getAgents(): Agent[] {
    return this.agents;
  }

  updateAgentConfig(agentId: string, newConfig: Partial<AgentConfig>) {
      this.agents = produce(this.agents, draft => {
          const agent = draft.find(a => a.id === agentId);
          if (agent) {
              console.log(`Updating config for agent: ${agent.name}`, newConfig);
              _.merge(agent.config, newConfig);
          }
      });
      this.saveConfigs();
  }
  
  private saveConfigs() {
      try {
          const configsToSave = this.agents.map(agent => ({
              id: agent.id,
              config: agent.config
          }));
          localStorage.setItem(AGENT_CONFIG_STORAGE_KEY, JSON.stringify(configsToSave));
      } catch (error) {
          console.error("Failed to save agent configs to localStorage:", error);
      }
  }

  private loadConfigs(): {id: string, config: AgentConfig}[] {
      try {
          const storedConfigs = localStorage.getItem(AGENT_CONFIG_STORAGE_KEY);
          return storedConfigs ? JSON.parse(storedConfigs) : [];
      } catch (error) {
          console.error("Failed to load agent configs from localStorage:", error);
          return [];
      }
  }
}

export const agentService = new AgentService(initialAgents);