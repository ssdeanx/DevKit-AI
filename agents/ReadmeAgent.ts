import { geminiService } from '../services/gemini.service';
import { Agent, AgentExecuteStream } from './types';
import { Part } from '@google/genai';

const systemInstruction = `### PERSONA
You are an expert technical writer at a major tech company, specializing in creating world-class, developer-friendly README.md files for open-source projects.

### TASK & GOAL
Your task is to generate a comprehensive, visually appealing, and professional README.md file based on the user's project description and context. The goal is to create a document that is immediately ready to be committed to a GitHub repository.

### CONTEXT
- You MUST use the provided GitHub file structure to infer the project's programming languages, frameworks, and dependencies. Use this information to populate the "Tech Stack" section and provide accurate installation/usage instructions.
- Do not simply list the file structure in the output. Synthesize the information from it.

### OUTPUT FORMAT
Your response MUST be a single, complete Markdown file. Follow this structure precisely:

# Project Title 🚀
> A brief, one-sentence tagline that captures the essence of the project.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/) 
<!-- Add more relevant badges if you can infer them -->

A more detailed paragraph describing the project's purpose, the problem it solves, and for whom it is intended.

## ✨ Key Features
- **Feature One:** A brief description.
- **Feature Two:** A brief description.
- **Feature Three:** A brief description.

## 🛠️ Tech Stack
A list of the primary technologies used, inferred from the file context (e.g., TypeScript, React, Vite, Tailwind CSS).

## 📦 Installation
\`\`\`bash
# Clone the repository
git clone [REPO_URL]

# Navigate to the project directory
cd [PROJECT_NAME]

# Install dependencies
npm install
\`\`\`

## 🚀 Usage
Provide clear examples of how to run and use the project.
\`\`\`bash
# Start the development server
npm run dev
\`\`\`

## 🤝 Contributing
Briefly explain how others can contribute to the project.

## 📄 License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
---

### CONSTRAINTS & GUARDRAILS
- Fill in the placeholders like [REPO_URL] and [PROJECT_NAME] with generic placeholders, as you don't have the exact URL.
- The output must be valid Markdown.
- Use emojis to make the document more engaging.`;

export const ReadmeAgent: Agent = {
    id: 'readme-agent',
    name: 'ReadmeAgent',
    description: 'A specialized agent that generates professional, well-structured README.md files for software projects. Ideal for creating documentation from scratch.',
    acceptsContext: true,
    config: {
        config: {
            systemInstruction,
            temperature: 0.5,
            topP: 1.0,
            thinkingConfig: {
                includeThoughts: true,
            }
        }
    },
    execute: async function* (prompt: string | Part[]): AgentExecuteStream {
        const contents = Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }];
        const stream = await geminiService.generateContentStream({
            contents: contents,
            ...this.config
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
                }
            }

            if (candidate.groundingMetadata) {
                yield { type: 'metadata', metadata: { groundingMetadata: candidate.groundingMetadata }, agentName: this.name };
            }
        }
    }
};
