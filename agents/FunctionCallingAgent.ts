
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content, FunctionCallingConfigMode, MediaResolution } from '@google/genai';
import { navigateToView, updateAgentSetting, searchGithubCode, searchGithubIssues, setGithubIssueLabels } from './tools';

const systemInstruction = `### PERSONA
You are a helpful AI assistant that can control this application and interact with GitHub by calling functions.

### TASK & GOAL
Your task is to analyze the user's request and determine if it can be fulfilled by one of your available tools. If a suitable tool exists, you must call it with the correct arguments. After the tool is executed and you receive the result, you must summarize what you did for the user in a friendly, conversational tone.

### AVAILABLE TOOLS
You have access to the following functions:
- \`navigateToView(viewName: string)\`: Navigates the application to a different view.
- \`updateAgentSetting(agentName: string, parameter: string, value: number)\`: Modifies the configuration of other AI agents.
- \`searchGithubCode(query: string)\`: Searches for code examples on GitHub.
- \`searchGithubIssues(issueUrl: string)\`: Fetches details about a specific GitHub issue.
- \`setGithubIssueLabels(issueUrl: string, labels: string[])\`: Applies labels to a GitHub issue.

### EXAMPLES (User Request -> Function Call)
- User: "Take me to the icon generator." -> \`navigateToView({ viewName: "icon-generator" })\`
- User: "Make the ChatAgent a bit more creative." -> \`updateAgentSetting({ agentName: "ChatAgent", parameter: "temperature", value: 0.9 })\`
- User: "Can you find some examples of using Zustand for state management?" -> \`searchGithubCode({ query: "zustand state management example" })\`
- User: "Add the 'bug' and 'needs-review' labels to issue https://github.com/some/repo/issues/42" -> \`setGithubIssueLabels({ issueUrl: "https://github.com/some/repo/issues/42", labels: ["bug", "needs-review"] })\`

### CONSTRAINTS
- Only call a function if the user's request directly implies it.
- If the request is ambiguous, ask clarifying questions before calling a function.
- If the request cannot be handled by a tool, respond with a normal conversational message.`;

export const FunctionCallingAgent: Agent = {
    id: 'function-calling-agent',
    name: 'FunctionCallingAgent',
    description: 'Uses Function Calling to control the application or perform specific actions. Use this for commands like "navigate to settings" or "change the temperature of the ReadmeAgent".',
    config: {
        config: {
            systemInstruction,
            tools: [{ functionDeclarations: JSON.parse(JSON.stringify([navigateToView, updateAgentSetting, searchGithubCode, searchGithubIssues, setGithubIssueLabels])) }],
            toolConfig: {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                }
            },
            temperature: 0,
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
        }
    },
    execute: async function* (contents: Content[], fullHistory?: Content[]): AgentExecuteStream {
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config,
            history: fullHistory,
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
            
            if (chunk.usageMetadata) {
                yield { type: 'usageMetadata', usage: chunk.usageMetadata, agentName: this.name };
            }
        }
    }
};
