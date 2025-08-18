# What's New? (Changelog)

This page tracks major updates, new features, and improvements to DevKit AI Pro.

---

### **Version 1.5.0**
*Date: August 19, 2025*

This update focuses on providing deeper insights into the AI's operations and costs.

**✨ New Features & Improvements:**
-   **New Feature: Workflow Token Tracking:** The Workflow Visualizer now displays the total token count for each completed step in a multi-agent plan. Hovering over the count reveals a detailed breakdown of input, output, and thinking tokens, providing transparency into API usage and cost.
-   **New Documentation:** Added a dedicated guide on "Workflow Token Tracking" to the documentation.

---

### **Version 1.4.0**
*Date: August 18, 2025*

This is a major intelligence and workflow upgrade, focusing on advanced Gemini capabilities and deeper GitHub integration.

**✨ New Features & Improvements:**
-   **New Feature: Vision-Powered Image Refinement:** The Icon and Logo generators now feature a **"Refine with AI"** button. This allows you to provide text feedback on a generated image, which a new multimodal AI agent uses to create an improved prompt for an iterative design workflow.
-   **New Feature: AI Issue Labeler:** A new tool in the "GitHub Pro" section that analyzes a GitHub issue URL and uses an AI agent to suggest and apply the most relevant labels from your repository.
-   **Smarter Chat Agent:** The main `ChatAgent` is now empowered with a **GitHub Code Search** tool. It can now find real-world code examples directly from GitHub when you ask.
-   **Enhanced AI Core:** Enabled Gemini's **`AUTO` function-calling mode** for key agents, allowing the model more autonomy to decide when to use its tools for more intelligent and responsive behavior.
-   **Flexible GitHub Pro View:** The GitHub Pro section is now accessible to all users, with premium API-dependent features intelligently disabled with tooltips if no API key is present.

---

### **Version 1.3.0**
*Date: August 16, 2025*

This is a major feature release focused on deep workflow integration and visualization enhancements.

**✨ New Features & Improvements:**
-   **New Feature: Pull Request Reviewer:** A new "GitHub Pro" tool that allows you to paste a GitHub PR URL and receive a comprehensive, AI-powered code review from the specialized `PullRequestAgent`.
-   **Supervisor Integration in Generators:** The `README Pro`, `Project Rules`, and `Code Graph` views now feature a real-time **"Agent Thoughts"** panel, providing transparency into the AI's reasoning process during generation.
-   **Major Code Graph Overhaul:**
    -   **Force-Directed Layout:** Replaced the static layout with a dynamic, physics-based graph.
    -   **Data-Driven Sizing:** Nodes and edges are now sized based on their number of connections.
    -   **Search & Highlight:** Added an interactive search panel to focus on specific nodes and their dependencies.
    -   **Node Icons:** Added file-type-specific icons directly within each graph node for better readability.

---
*Version 1.5.0*