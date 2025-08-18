# Deep Dive: The AI Pull Request Reviewer

The AI Pull Request Reviewer, powered by the `PullRequestAgent`, is one of the flagship features of GitHub Pro. It provides expert-level code reviews on your pull requests, helping you catch bugs, improve code quality, and maintain high standards across your projects.

---

## The `PullRequestAgent`

At the core of this feature is the `PullRequestAgent`. This agent has been given the persona of a Staff Software Engineer at Google. Its system prompt instructs it to perform a comprehensive review across several key dimensions:

-   **Correctness & Bugs:** Identifying logical errors and potential edge cases.
-   **Best Practices:** Ensuring the code adheres to established design patterns.
-   **Readability:** Checking for clean, maintainable, and well-documented code.
-   **Security:** Looking for common vulnerabilities.
-   **Performance:** Spotting potential bottlenecks.

The agent is trained to provide feedback that is constructive and actionable, aiming to collaborate with the developer, not just criticize.

## How to Use the Reviewer

The primary way to use this feature is through the **GitHub Pro** view.

1.  **Navigate to GitHub Pro:** Select "GitHub Pro" from the sidebar.
2.  **Ensure API Key is Set:** This feature requires a GitHub Personal Access Token (PAT) to fetch your assigned pull requests. Make sure you have added one in the **GitHub Inspector** view.
3.  **Fetch Your PRs:** In the "My Pull Requests" tab, click the **Refresh** button. The application will securely query the GitHub API and list all open pull requests assigned to you.
4.  **Select a PR:** Click on any pull request from the list. The application will automatically fetch all the files that have been changed in that PR. This provides the necessary context for the agent.
5.  **Generate AI Review:** Click the **Generate AI Review** button. The `supervisor` will package the changed file contents and send them to the `PullRequestAgent`.
6.  **Review the Output:** The agent will stream its review in a structured markdown format, including a summary, a detailed list of suggestions categorized by file and severity, and a conclusion.

```mermaid
graph TD
    subgraph "GitHub Pro View"
        A[1. Refresh PRs] --> B(2. Select PR from List);
        B --> C[3. App Fetches Changed Files];
        C --> D[4. Click "Generate AI Review"];
    end

    subgraph "Backend Process"
        E(Supervisor)
        F(PullRequestAgent)
        G(Gemini API)
    end

    D --> E;
    E -- Sends context --> F;
    F -- Generates review --> G;
    G -- Streams response --> F;
    F -- Streams to --> E;
    
    subgraph "UI Response"
        H[5. Review appears on screen]
    end
    
    E --> H;
```

## Tips for Best Results

-   **Clear PR Descriptions:** While the agent focuses on code, a clear pull request description helps it understand the *intent* of the changes, leading to a more insightful review.
-   **Focused PRs:** Smaller, more focused pull requests are easier for both humans and AI to review effectively.
-   **Provide Feedback:** If a review is particularly good or misses something important, use the feedback buttons in the Chat view (if you were to run it there) to help the system learn.

---
*Version 1.4.0*