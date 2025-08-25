
# Troubleshooting & FAQ

This page provides answers to common questions and solutions for potential issues you might encounter while using DevKit AI Pro.

---

### GitHub Inspector

#### **Q: I'm getting a "GitHub API rate limit exceeded" error. What should I do?**

**A:** This is the most common issue and happens when you make too many requests to GitHub without an API key.

**Solution: Use a Personal Access Token (PAT)**
Using a PAT significantly increases your request limit.

1.  **Generate a PAT:** Follow GitHub's official guide to [create a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
    -   **Important:** You need to use a **"classic"** token, not a "fine-grained" one.
    -   **Scopes:** For public repositories, you only need to grant the `public_repo` scope. For private repositories, you must grant the full `repo` scope.
2.  **Add the PAT to DevKit:**
    -   Go to the **GitHub Inspector** view.
    -   Paste your new token (it will start with `ghp_`) into the "GitHub API Key (Optional)" field.
3.  **Reload:** Click "Load Repository" again.

Your PAT is stored securely *only in your browser's local storage* and is never sent anywhere else.

#### **Q: I've added my API key, but I'm getting an "Authentication failed" error.**

**A:** This error means the key you provided is invalid, expired, or doesn't have the correct permissions.

**Troubleshooting Steps:**
1.  **Check the Token:** Double-check that you have copied the entire token correctly.
2.  **Verify Token Type:** Ensure you created a **"classic"** Personal Access Token, not a "fine-grained" one.
3.  **Check Scopes:** For private repositories, make sure your token has the full `repo` scope enabled.
4.  **Check Expiration:** Ensure your token has not expired. You may need to generate a new one.

#### **Q: The file tree is taking a long time to load or says it's "truncated."**

**A:** This happens with very large repositories that contain thousands of files. The GitHub API may truncate the response to save bandwidth. While the core files should still be visible, you might not see everything. For now, the best practice is to work with smaller to medium-sized repositories or be aware that the file tree may be incomplete for massive monorepos.

---

### AI Generations

#### **Q: My generated README or Code Graph seems generic and not specific to my project.**

**A:** This is almost always a context issue. The AI can only be specific if you provide it with specific information.

**Solution: Stage More Files**
1.  Go back to the **GitHub Inspector**.
2.  Ensure you have staged the key files that represent your project's logic. For a README, this might include your main application file (`App.tsx`, `main.py`), key service files, and configuration files.
3.  Return to the generator view and try again. The more relevant context you provide, the better the result will be.

#### **Q: The AI's response seems to be stuck in a loop or is not helpful.**

**A:** AI models can sometimes get stuck or misinterpret a prompt.

**Solution: Give Negative Feedback & Retry**
1.  Click the **Thumbs Down (👎)** icon on the response.
2.  A feedback modal will appear. Briefly explain what was wrong (e.g., "You are repeating the same thing," or "This answer is incorrect.").
3.  Submitting the feedback will trigger a retry attempt where the AI is instructed to correct its mistake based on your feedback.

---
*Version 1.3.0*