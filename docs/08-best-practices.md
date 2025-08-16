
# Best Practices & Pro Tips

Follow these guidelines to get the most accurate, relevant, and helpful responses from DevKit AI Pro.

---

### 1. Context is Everything
The single most important factor for high-quality, project-specific results is providing good context.
-   **Always Load Your Repo First:** Before starting a complex task, go to the **GitHub Inspector** and load your repository.
-   **Stage Relevant Files:** Be selective. If you're working on a UI component, stage that component's file, its parent view, and any services it uses. You don't need to stage the entire backend.
-   **Update Context as You Work:** If you're refactoring a file, remember to re-stage it so the AI has the latest version.

### 2. Craft Effective Prompts
How you ask your question matters.

```mermaid
graph TD
    A[Start: I need help] --> B{Is my prompt specific?};
    B -- No --> C[Refine: Add code, state the error,<br/>define the goal clearly];
    C --> B;
    B -- Yes --> D{Can I provide an example?};
    D -- Yes --> E[Add an example of the<br/>desired output style];
    E --> F{Can I assign a persona?};
    D -- No --> F;
    F -- Yes --> G[Add "Act as..." instruction];
    G --> H[Submit Prompt];
    F -- No --> H;
    H --> I[Collaborate & Iterate<br/>(e.g., use RefinerAgent)];
    I --> J[Excellent Result];
```

-   **Be Specific:** Instead of "fix my code," paste the code block and say, "This React component is not re-rendering when the props change. Can you identify the issue in this code?"
-   **Provide Examples:** If you want code in a specific style, show the AI an example. "Generate a new service function that follows the pattern in this existing file..."
-   **Assign a Persona:** While agents have default personas, you can guide them further. "Act as a senior database administrator and critique this SQL schema..."
-   **Iterate:** Don't expect a perfect result on the first try. Use the AI as a collaborator. Generate a first draft, then ask the `RefinerAgent` to improve it by saying, "Okay, now make this more concise and add code comments."

### 3. Use the Right Tool for the Job
While the Orchestrator is smart, you can guide it by using the dedicated UI views. This ensures the most specialized agent is used. For a full list of capabilities, review the [**Meet the Agents**](./04-the-agents.md) guide.
-   For generating a README, always use the **README Pro Generator** view.
-   For generating images, use the **Icon** or **Logo/Banner** generators.
-   These views are specifically designed to interact with the most specialized agent for that task.

### 4. Give Feedback to Help the AI Learn
-   **Use the Thumbs Up/Down Buttons:** This is the primary mechanism for the AI to learn.
-   **Provide a Reason for Bad Responses:** When you give a thumbs down, a modal will appear. Briefly explain *why* the response was bad (e.g., "The code had a bug," "The answer was factually incorrect," "This didn't follow my instructions"). This feedback is crucial for the retry attempt and for creating a long-term memory to avoid the same mistake in the future.

---
*Version 1.3.0*
