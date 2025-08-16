
import { GenerateContentParameters, FunctionCall, Part, GroundingMetadata, Content } from '@google/genai';
import { WorkflowStep } from '../App';

// This now mirrors the full GenerateContentParameters, allowing each agent
// to be configured with its own complete set of tools and configs.
export type AgentConfig = Omit<GenerateContentParameters, 'contents' | 'model'>;

export interface WorkflowPlan {
    plan: WorkflowStep[];
}

export type AgentExecuteStreamChunk = 
    | { type: 'thought', content: string, agentName?: string }
    | { type: 'content', content: string, agentName?: string }
    | { type: 'functionCall', functionCall: FunctionCall, agentName?: string }
    | { type: 'workflowUpdate', plan: WorkflowStep[], agentName?: string }
    | { type: 'metadata', metadata: { groundingMetadata: GroundingMetadata }, agentName?: string };


export type AgentExecuteStream = AsyncGenerator<AgentExecuteStreamChunk, void, unknown>;

export interface Agent {
    id: string;
    name: string;
    description: string;
    config: AgentConfig; // Each agent has its own full config now
    acceptsContext?: boolean;
    execute: (contents: Content[], fullHistory?: Content[]) => AgentExecuteStream;
}
