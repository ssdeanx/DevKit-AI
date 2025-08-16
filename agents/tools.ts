
import { Type } from '@google/genai';

const AGENT_NAMES = [
    "ChatAgent", "PlannerAgent", "ReadmeAgent", "ProjectRulesAgent", "ResearchAgent", "RefinerAgent",
    "IconPromptAgent", "CodeExecutionAgent", "StructuredOutputAgent", "UrlAgent", "FunctionCallingAgent", 
    "CodeGraphAgent", "PullRequestAgent", "IssueLabelAgent", "ImageRefinementAgent"
];

const VIEW_NAMES = ['chat', 'project-rules', 'readme-generator', 'icon-generator', 'logo-generator', 'github-inspector', 'code-graph', 'github-pro', 'history', 'settings'];

export const navigateToView = {
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

export const updateAgentSetting = {
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

export const searchGithubCode = {
    name: 'searchGithubCode',
    description: "Searches public repositories on GitHub for code snippets and examples.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: "The search query, which can include language, library, or function names (e.g., 'react hook d3-force')."
            }
        },
        required: ['query']
    }
};

export const searchGithubIssues = {
    name: 'searchGithubIssues',
    description: "Fetches details for a specific GitHub issue, including its title, body, and the repository's available labels.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            issueUrl: {
                type: Type.STRING,
                description: "The full URL of the GitHub issue."
            }
        },
        required: ['issueUrl']
    }
};

export const setGithubIssueLabels = {
    name: 'setGithubIssueLabels',
    description: "Applies a list of labels to a specific GitHub issue, replacing any existing labels.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            issueUrl: {
                type: Type.STRING,
                description: "The full URL of the GitHub issue."
            },
            labels: {
                type: Type.ARRAY,
                description: "An array of strings, where each string is the exact name of a label to apply.",
                items: { type: Type.STRING }
            }
        },
        required: ['issueUrl', 'labels']
    }
};
