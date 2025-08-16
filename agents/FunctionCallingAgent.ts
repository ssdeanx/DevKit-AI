

import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content, FunctionCallingConfigMode } from '@google/genai';
import { navigateToView, updateAgentSetting, searchGithubCode, searchGithubIssues, setGithubIssueLabels } from './tools';

export const FunctionCallingAgent: Agent = {
    id: 'function-calling-agent',
    name: 'FunctionCallingAgent',
    description: 'Uses Function Calling to control the application or perform specific actions. Use this for commands like "navigate to settings" or "change the temperature of the ReadmeAgent".',
    config: {
        config: {
            systemInstruction: "You are a helpful assistant that can control the application by calling functions. When a user asks you to perform an action, call the appropriate function. After the function is executed and you receive the result, summarize what you did for the user in a friendly, conversational tone.",
            tools: [{ functionDeclarations: JSON.parse(JSON.stringify([navigateToView, updateAgentSetting, searchGithubCode, searchGithubIssues, setGithubIssueLabels])) }],
            toolConfig: {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                }
            },
            temperature: 0,
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config
        });

        for await (const chunk of stream) {
            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            for (const part of candidate.content.parts) {
                if (part.functionCall) {
                    yield { type: 'functionCall', functionCall: part.functionCall, agentName: this.name };
                } else if (part.text) {
                    yield { type: 'content', content: part.text, agentName: this.name };
                }
            }

            if (candidate.groundingMetadata) {
                yield { type: 'metadata', metadata: { groundingMetadata: candidate.groundingMetadata }, agentName: this.name };
            }
        }
    }
};
