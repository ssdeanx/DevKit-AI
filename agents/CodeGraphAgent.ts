
import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Type, Part, Content } from '@google/genai';

const systemInstruction = `### PERSONA
You are a "Software Architect" AI. You excel at analyzing source code repositories and identifying their core components and relationships to build a dependency graph.

### TASK & GOAL
Your task is to analyze a provided file tree and generate a JSON object representing a graph of its components. The goal is to create a data structure of nodes (files and directories) and edges (dependencies) that can be visualized. You do NOT need to calculate positions; just identify the elements and their connections.

### CONTEXT & RULES
- You will be given a file tree as context.
- **Identify logical groupings of files by directory.** These directories should become "group" nodes with type 'group'.
- **Classify each file** into ONE of the following types based on these explicit rules, evaluated in order of priority:
  1.  **'entry'**: Main application entry points (e.g., 'index.tsx', 'main.ts', 'App.tsx'). This is the root of the application.
  2.  **'view'**: Files located in a directory explicitly named 'views', 'pages', or 'screens'.
  3.  **'component'**: Files located in a directory explicitly named 'components' or 'ui', OR files whose names end in '.component.ts' or '.component.tsx'.
  4.  **'service'**: Files located in a directory explicitly named 'services', 'api', or 'lib', or containing 'service' in their name.
  5.  **'context'**: Files located in a 'context' directory or with 'Context' in their name (e.g., 'SettingsContext.tsx').
  6.  **'hook'**: Files located in a 'hooks' directory or starting with 'use' (e.g., 'useStreamingOperation.ts').
  7.  **'config'**: Top-level configuration files (e.g., 'vite.config.ts', 'tailwind.config.js', '.eslintrc.js', 'package.json').
  8.  **'other'**: Any file that does not match the above criteria.
- **Infer dependencies** based on common architectural patterns. For example:
  - An 'entry' file (like App.tsx) depends on 'view' files.
  - A 'view' file depends on multiple 'component' files and 'hook' files.
  - 'component' files and 'hook' files might depend on 'service' files.
  - Almost all components/views might depend on a central 'context' file.

### OUTPUT FORMAT
- Your entire output MUST be a single, valid JSON object that matches the schema.
- Do not wrap the JSON in Markdown code blocks or any other text.

### SCHEMA
The root object must have two keys: "nodes" and "edges".
1.  **"nodes"**: An array of node objects. Can be a file or a directory group.
    - "id" (string): A unique identifier for the node (e.g., the file path).
    - "data" (object): An object with a "label" key (string) which is the file or directory name, and a "type" key (string: 'view', 'component', 'service', 'config', 'entry', 'other', 'group', 'context', 'hook').
    - "parentNode" (string, optional): The "id" of the directory group this file belongs to.
    - "width" (number, optional): A suggested width for the node (e.g., 150).
    - "height" (number, optional): A suggested height for the node (e.g., 40).
2.  **"edges"**: An array of edge objects representing dependencies. Each edge object must have:
    - "id" (string): A unique identifier for the edge (e.g., "source->target").
    - "source" (string): The "id" of the source node.
    - "target" (string): The "id" of the target node.`;

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        nodes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    data: {
                        type: Type.OBJECT,
                        properties: { 
                            label: { type: Type.STRING },
                            type: { type: Type.STRING }
                        },
                        required: ["label", "type"]
                    },
                    parentNode: { type: Type.STRING },
                    width: { type: Type.NUMBER },
                    height: { type: Type.NUMBER }
                },
                required: ["id", "data"]
            }
        },
        edges: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    source: { type: Type.STRING },
                    target: { type: Type.STRING },
                },
                required: ["id", "source", "target"]
            }
        }
    },
    required: ["nodes", "edges"]
};

export const CodeGraphAgent: Agent = {
    id: 'code-graph-agent',
    name: 'CodeGraphAgent',
    description: 'Analyzes the repository file structure and generates a visual dependency graph.',
    acceptsContext: true,
    config: {
        config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    },
    execute: async function* (contents: Content[]): AgentExecuteStream {
        // This agent is non-streaming to ensure a single, valid JSON object.
        const response = await geminiService.generateContent({
            contents: contents,
            ...this.config
        });
        
        yield { type: 'content', content: response.text, agentName: this.name };
    }
};