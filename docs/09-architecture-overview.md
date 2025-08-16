# Architecture Overview

This document provides a technical overview of the DevKit AI Pro application, its core components, and the data flow for a typical AI request.

## 1. High-Level Design

The application is a single-page application (SPA) built with **React** and **TypeScript**. Its architecture is designed around three core principles:
- **Modularity:** Functionality is broken down into distinct, reusable components and services.
- **Agentic Design:** Complex AI tasks are handled not by a single model, but by a collection of specialized **Agents**, each with a unique purpose, configuration, and toolset.
- **Context-Awareness:** The system is designed to deeply integrate with a developer's project context, primarily through the staging of files from a GitHub repository.

> **💡 Architectural Note:** The agentic design allows for greater maintainability and specialization. Instead of trying to perfect one massive system prompt, we can fine-tune each agent's persona and configuration independently for its specific task, leading to higher-quality results.

## 2. Core Components & Directory Structure

-   `/components`: Reusable React components (`Button`, `Card`, `Sidebar`, etc.).
-   `/context`: React Context providers for managing global state (`GithubContext`, `SettingsContext`).
-   `/agents`: The heart of the AI system. Each file defines a specialized `Agent` with its own system prompt, configuration, and execution logic.
-   `/services`: Core logic for interacting with external APIs and managing application state.
-   `/views`: Top-level components that represent the different screens or "tools" of the application (`ChatView`, `ReadmeView`, etc.).
-   `/docs`: Contains all markdown-based documentation files and the `manifest.json`.

### Key Services

-   `gemini.service.ts`: A lightweight wrapper around the `@google/genai` SDK.
-   `github.service.ts`: Handles all interactions with the GitHub API.
-   `agent.service.ts`: Manages the state of all available agents and their configurations.
-   `orchestrator.ts`: Analyzes user intent to select the most appropriate agent.
-   `supervisor.ts`: The central controller for all AI interactions.
-   `short-term-memory.service.ts`: A simple in-memory store for the current conversation.
-   `agent-memory.service.ts`: Manages long-term memories in IndexedDB.

## 3. The Agentic Workflow: A Request's Lifecycle

This sequence describes what happens when a user sends a message from the `ChatView`.

```mermaid
sequenceDiagram
    actor User
    participant ChatView
    participant Supervisor
    participant Orchestrator
    participant Agent
    participant GeminiAPI

    User->>ChatView: 1. Submits Prompt
    ChatView->>Supervisor: 2. handleRequest(prompt)
    
    Supervisor->>Orchestrator: 3. selectAgent(prompt)
    Orchestrator-->>Supervisor: 4. Returns chosen Agent
    
    loop Context Assembly
        Supervisor->>Supervisor: 5. Gathers GitHub context, STM, LTM
    end

    Supervisor->>Agent: 6. execute(fullContext)
    Agent->>GeminiAPI: 7. generateContentStream()
    
    GeminiAPI-->>Agent: 8. Streams response chunks
    Agent-->>Supervisor: 9. Streams response chunks
    Supervisor-->>ChatView: 10. Streams response chunks
    
    ChatView-->>User: 11. Displays streaming response

    Note over Supervisor,GeminiAPI: After response, Supervisor may trigger memory consolidation.
```

1.  **Request Initiation (`ChatView.tsx`):** The user's prompt is captured and `supervisor.handleRequest()` is called.

2.  **Context Assembly (`supervisor.ts`):** The `supervisor` gathers all available context: short-term memory, long-term memory, staged GitHub file content, and any retry/feedback information.

3.  **Agent Selection (`orchestrator.ts`):** The `supervisor` calls `orchestrator.selectAgent()`. The orchestrator uses Gemini to choose the best agent for the user's intent from a list of available agents.

4.  **Execution Planning (`supervisor.ts`):**
    -   **If the agent is `PlannerAgent`:** A multi-step workflow is initiated. The `PlannerAgent` returns a JSON plan, which the `supervisor` then executes step-by-step, feeding the output of one agent into the next.
    -   **If the agent is any other agent:** A single-step workflow is executed.

5.  **Agent Execution (`agents/*.ts`):** The `supervisor` calls the `.execute()` method on the chosen agent, passing the fully assembled context. The agent's `execute` method makes a streaming call to the Gemini API using its own specific system prompt and configuration.

6.  **Function Calling Loop (`supervisor.ts`):** If the agent's response includes a request to call a function (e.g., `navigateToView`), the `supervisor` executes the function, gets the result, and sends it back to the agent to continue its reasoning process.

7.  **Response Streaming (`ChatView.tsx`):** The `ChatView` consumes the stream from the `supervisor` and updates the UI in real-time as `thought`, `content`, or `workflowUpdate` chunks arrive.

8.  **Memory Consolidation (`supervisor.ts`):** After the turn is complete, the `supervisor` may trigger the `MemoryAgent` to summarize the interaction and save any important, novel information to long-term memory for future use.

---
*Version 1.2.1*