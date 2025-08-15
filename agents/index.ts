

import { Agent } from "./types";
import { ChatAgent } from "./ChatAgent";
import { ReadmeAgent } from "./ReadmeAgent";
import { ResearchAgent } from "./ResearchAgent";
import { RefinerAgent } from "./RefinerAgent";
import { IconPromptAgent } from "./IconPromptAgent";
import { CodeExecutionAgent } from "./CodeExecutionAgent";
import { StructuredOutputAgent } from "./StructuredOutputAgent";
import { UrlAgent } from "./UrlAgent";
import { ProjectRulesAgent } from "./ProjectRulesAgent";
import { FunctionCallingAgent } from "./FunctionCallingAgent";
import { PlannerAgent } from "./PlannerAgent";
import { CodeGraphAgent } from "./CodeGraphAgent";

export const initialAgents: Agent[] = [
    ChatAgent,
    PlannerAgent,
    ReadmeAgent,
    ProjectRulesAgent,
    ResearchAgent,
    RefinerAgent,
    IconPromptAgent,
    CodeExecutionAgent,
    StructuredOutputAgent,
    UrlAgent,
    FunctionCallingAgent,
    CodeGraphAgent,
];

export const defaultAgent = ChatAgent;

export type { Agent };