
import { GenerateContentParameters, FunctionCall, Part } from '@google/genai';

// This now mirrors the full GenerateContentParameters, allowing each agent
// to be configured with its own complete set of tools and configs.
export type AgentConfig = Omit<GenerateContentParameters, 'contents' | 'model'>;

export type AgentExecuteStreamChunk = 
    | { type: 'thought', content: string }
    | { type: 'content', content: string }
    | { type: 'functionCall', functionCall: FunctionCall };

export type AgentExecuteStream = AsyncGenerator<AgentExecuteStreamChunk, void, unknown>;

export interface Agent {
    id: string;
    name: string;
    description: string;
    config: AgentConfig; // Each agent has its own full config now
    acceptsContext?: boolean;
    execute: (prompt: string | Part[]) => AgentExecuteStream;
}
