
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content } from '@google/genai';

// CRITICAL FIX & BEST PRACTICE: To avoid a circular dependency runtime error 
// (e.g., FunctionCallingAgent -> supervisor -> agentService -> FunctionCallingAgent),
// we define the agent and view names statically. This makes the system more robust.
const AGENT_NAMES = [
    "ChatAgent", "PlannerAgent", "ReadmeAgent", "ProjectRulesAgent", "ResearchAgent", "RefinerAgent", 
    "IconPromptAgent", "CodeExecutionAgent", "StructuredOutputAgent", "UrlAgent", "FunctionCallingAgent", "CodeGraphAgent", "PullRequestAgent"
];

const VIEW_NAMES = ['chat', 'project-rules', 'readme-generator', 'icon-generator', 'logo-generator', 'github-inspector', 'code-graph', 'pr-reviewer', 'history', 'settings'];

const navigateToView = {
    name: 'navigateToView',
    description: 'Navigates the application to a specified view.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            viewName: {
                type: Type.STRING,
                description: 'The name of the view to navigate to.',
                enum: VIEW_NAMES
            },
        },
        required: ['viewName'],
    },
};

const updateAgentSetting = {
    name: 'updateAgentSetting',
    description: "Updates a specific configuration parameter for a given AI agent.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            agentName: {
                type: Type.STRING,
                description: "The name of the agent to update.",
                enum: AGENT_NAMES,
            },
            parameter: {
                type: Type.STRING,
                description: "The configuration parameter to change.",
                enum: ["temperature", "topP", "topK", "maxOutputTokens"]
            },
            value: {
                type: Type.NUMBER,
                description: "The new value for the parameter."
            }
        },
        required: ['agentName', 'parameter', 'value']
    }
};

export const FunctionCallingAgent: Agent = {
    id: 'function-calling-agent',
    name: 'FunctionCallingAgent',
    description: 'Uses Function Calling to control the application or perform specific actions. Use this for commands like "navigate to settings" or "change the temperature of the ReadmeAgent".',
    config: {
        config: {
            systemInstruction: "You are a helpful assistant that can control the application by calling functions. When a user asks you to perform an action, call the appropriate function. After the function is executed and you receive the result, summarize what you did for the user in a friendly, conversational tone.",
            tools: [{ functionDeclarations: [navigateToView, updateAgentSetting] }],
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
