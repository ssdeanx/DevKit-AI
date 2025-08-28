# Advanced Function Calling

DevKit AI Pro leverages the full power of the Gemini API's function calling capabilities, enabling complex, multi-step workflows where the AI can use multiple tools to accomplish a task. This is orchestrated by the `Supervisor` service, which acts as a robust execution loop.

This process enables two key advanced features: **parallel function calling** and **compositional function calling**.

---

## The Supervisor's Execution Loop

When an agent like `FunctionCallingAgent` or `IssueLabelAgent` is selected, the `Supervisor` initiates an execution loop. This loop allows the AI to have a multi-turn conversation with its available tools, enabling it to chain commands or run them in parallel.

```mermaid
sequenceDiagram
    participant Supervisor
    participant Agent
    participant Gemini API
    participant Tools

    Supervisor->>Agent: 1. Execute with history
    Agent->>Gemini API: 2. generateContentStream(history)
    Gemini API-->>Agent: 3. Streams response (contains function calls)
    Agent-->>Supervisor: 4. Returns stream of parsed chunks
    
    Note over Supervisor: 5. Extracts ALL function calls from the agent's stream
    
    Supervisor->>Tools: 6. Executes tools in parallel (Promise.all)
    Tools-->>Supervisor: 7. Returns tool results
    
    Note over Supervisor: 8. Appends function calls & results to history
    
    loop Is another tool call needed?
        Supervisor->>Agent: 9. Re-prompts with updated history
        Note right of Agent: Agent now has results of previous tools
        ...
    end
    
    Note over Supervisor: 10. No more function calls, returns final text response.
```

---

### 1. Parallel Function Calling

In some cases, the AI can be more efficient by calling multiple tools at once.

**Example:**
> User: "Turn this place into a party!" (A hypothetical command for a smart home)

The `FunctionCallingAgent` might determine that it needs to turn on a disco ball, start music, and dim the lights. These actions are not dependent on each other and can happen at the same time.

-   The model returns a response containing **three separate `functionCall` objects** in a single turn.
-   The `Supervisor` detects all three calls from the agent's stream.
-   It uses `Promise.all` to execute all three tool functions **concurrently**.
-   It then sends all three tool responses back to the model in the next turn so the AI can confirm that all actions were completed.

This parallel execution significantly reduces the latency for tasks that involve multiple independent actions.

---

### 2. Compositional (Sequential) Function Calling

This is when the AI needs to chain tool calls together, using the output of one call as the input for the next. This is the foundation of complex, multi-step reasoning.

**Example:** The `IssueLabelAgent` workflow.
> User: "Please label this issue: [GitHub URL]"

1.  **Turn 1:** The agent knows it needs information first. It calls the `searchGithubIssues` tool with the URL.
2.  **Supervisor Execution:** The supervisor runs the tool, which returns the issue's title, body, and a list of available labels for the repository.
3.  **Turn 2:** The supervisor sends this information back to the agent in the next turn's history. The agent now has the context it needs to reason. It analyzes the text and decides which of the available labels are appropriate.
4.  **Turn 3:** The agent calls the `setGithubIssueLabels` tool with the URL and its chosen list of labels (e.g., `['bug', 'v2.0']`).
5.  **Supervisor Execution:** The supervisor applies the labels via the GitHub API.
6.  **Turn 4:** The supervisor sends the success message back to the agent.
7.  **Final Response:** With all tools executed successfully, the agent now generates its final text response to the user: "I have successfully applied the 'bug' and 'v2.0' labels to the issue."

This ability to create a chain of dependent tool calls allows the AI to tackle much more complex and dynamic problems than a single function call would allow.

---
*Version 1.5.0*