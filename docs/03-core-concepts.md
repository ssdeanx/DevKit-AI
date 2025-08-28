
# Core Concepts: The Agentic Workflow & Memory Architecture

DevKit AI Pro is built on an **agentic architecture**. Instead of a single, monolithic AI model, your requests are handled by a team of specialized AI agents. This is coupled with a sophisticated, multi-tiered memory system inspired by human cognition.

---

### 1. The Supervisor & Orchestrator: The Management Team

At the heart of the system are two central components that manage the entire AI workflow.

-   **The Orchestrator:** When you submit a prompt, the Orchestrator analyzes your *intent* and selects the single best agent for the job.
-   **The Supervisor:** This is the project manager. It assembles context, delegates tasks to the chosen agent, manages tools, and oversees multi-step plans.

---

### 2. The Three-Tier Memory Architecture

The AI's "mind" is organized into three distinct layers, allowing it to manage information for different purposes.

```mermaid
graph TD
    subgraph "Memory Tiers"
        A[<b>Tier 1: Working Memory</b><br/><i>(The Scratchpad)</i><br/>- Current Task & Plan<br/>- Real-time Observations<br/>- Volatile & Task-Specific]
        B[<b>Tier 2: Episodic Memory</b><br/><i>(The Logbook)</i><br/>- Raw Conversation History<br/>- Sequential Event Record]
        C[<b>Tier 3: Semantic Memory</b><br/><i>(The Knowledge Base)</i><br/>- Factual Knowledge (Code, Text)<br/>- Consolidated Chat Summaries<br/>- Vectorized for RAG]
    end

    subgraph "Memory Processors (System Agents)"
        D(ContextRetrievalAgent)
        E(MemoryConsolidationAgent)
    end
    
    subgraph "Main AI Agent"
        F(Primary Agent<br/>e.g., ChatAgent)
    end

    B -- Raw Data --> E
    E -- Extracts Key Facts --> C
    
    A -- Current State --> D
    B -- Recent Events --> D
    C -- Factual Knowledge --> D
    
    D -- Assembles Full Context --> F
```

#### Tier 1: Working Memory (The Scratchpad)
This is the AI's short-term, conscious thought process for the *current task*. It's a volatile space holding the active plan, incoming observations, and the agent's internal monologue.
> **See it in action:** The **Working Memory** view provides a live dashboard of this scratchpad, showing you exactly what the AI is thinking.

#### Tier 2: Episodic Memory (The Logbook)
This is a chronological record of events—primarily, your conversation history. It's the AI's memory of "what happened." This raw data is the source material for creating more permanent, semantic memories.

#### Tier 3: Semantic Memory (The Knowledge Base)
This is the AI's long-term storage for facts, concepts, and learned information. It's a searchable **vector database** that stores:
-   The content of your staged code files.
-   Text documents you add manually.
-   **Consolidated summaries** from past conversations.

This is the foundation for the powerful Retrieval-Augmented Generation (RAG) system.

---

### 3. Memory Processors

Specialized system agents work in the background to manage this memory architecture.

-   **`ContextRetrievalAgent`:** Before any agent acts, this "retrieval processor" is activated. It systematically queries all three memory tiers to build a rich, multi-faceted context package for the primary agent. It grabs the current plan from Working Memory, the last few messages from Episodic Memory, and relevant facts from Semantic Memory.

-   **`MemoryConsolidationAgent`:** This "consolidation processor" turns raw experience into durable knowledge. When triggered (e.g., via the "Consolidate Chat History" button in the Knowledge Base), it reads the raw Episodic Memory (chat log), identifies the most important new facts or user preferences, and writes a clean summary into the Semantic Memory (Knowledge Base). This is how the AI *learns* from your conversations.

This entire system—the specialized agents, the tiered memory, and the processors that manage it—creates a robust cognitive loop that allows the AI to reason, learn, and act with a much deeper level of contextual understanding.

---
*Version 1.9.0*
