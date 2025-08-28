
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part, Content, FunctionCallingConfigMode, MediaResolution } from '@google/genai';
import { searchGithubIssues, setGithubIssueLabels } from './tools';

const systemInstruction = `### PERSONA
You are an expert AI triage engineer for a large open-source project. You are exceptionally good at reading a GitHub issue and immediately understanding its intent and category.

### TASK & GOAL
Your task is to analyze a GitHub issue and suggest the most appropriate labels for it from a provided list of available labels. You will use a two-step function-calling process to achieve this. Your ultimate goal is to correctly label the issue.

### PROCESS (Chain of Thought with Function Calls)
1.  **Analyze and Fetch:** The user will give you a GitHub issue URL. Your first step is to call the \`searchGithubIssues\` function with this URL. This will give you the issue's title, body, and a complete list of all available labels in that repository.
2.  **Reason and Select:** After you get the issue details and the available labels, you must reason about which labels are the best fit. Your internal monologue should look something like this: "The issue title mentions 'crash on startup' and the body includes a stack trace. This is clearly a bug. From the available labels, 'bug' is the most appropriate. The user also mentions it's on the 'v2 beta', so the 'v2' label is also relevant."
3.  **Apply Labels:** Call the \`setGithubIssueLabels\` function with the original issue URL and an array of the label names you selected.
4.  **Confirm:** After successfully applying the labels, provide a concise confirmation message to the user, listing the labels you applied.

### CONSTRAINTS
- You MUST use the provided tools. Do not hallucinate labels that don't exist in the list returned by \`searchGithubIssues\`.
- If the issue content is unclear, it's better to apply a generic label like "needs-triage" than to apply an incorrect one.
- Only apply a few (1-3) of the most relevant labels. Do not apply every possible label.`;


export const IssueLabelAgent: Agent = {
    id: 'issue-label-agent',
    name: 'IssueLabelAgent',
    description: 'A specialized agent that analyzes a GitHub issue and suggests/applies appropriate labels.',
    acceptsContext: false, // This agent works with URLs, not staged files
    config: {
        config: {
            systemInstruction,
            temperature: 0.1,
            tools: [{ functionDeclarations: JSON.parse(JSON.stringify([searchGithubIssues, setGithubIssueLabels])) }],
            toolConfig: {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                }
            },
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 8192,
            },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
        }
    },
    execute: async function* (contents: Content[], fullHistory?: Content[]): AgentExecuteStream {
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config,
            // Pass the full history for multi-turn function calling
            history: fullHistory, 
        });
        for await (const chunk of stream) {
            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            for (const part of candidate.content.parts) {
                if(part.text){
                    if(part.thought){
                        yield { type: 'thought', content: part.text, agentName: this.name };
                    } else {
                        yield { type: 'content', content: part.text, agentName: this.name };
                    }
                } else if (part.functionCall) {
                    yield { type: 'functionCall', functionCall: part.functionCall, agentName: this.name };
                }
            }
            
            if (chunk.usageMetadata) {
                yield { type: 'usageMetadata', usage: chunk.usageMetadata, agentName: this.name };
            }
        }
    }
};