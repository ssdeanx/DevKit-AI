# Token Usage & Cost

In Gemini and other generative AI models, all input and output is processed in units called **tokens**. Understanding tokens is helpful for managing costs and optimizing your requests.

---

## About Tokens

Tokens can be single characters (like `z`), whole words (like `cat`), or parts of longer words. The process of splitting text into these units is called **tokenization**.

For Gemini models, a token is roughly equivalent to about 4 characters in English. As a rule of thumb, 100 tokens is about 60-80 English words.

When billing is enabled, the cost of an API call is partly determined by the number of input and output tokens, so knowing how to count them can be useful.

## How to Count Tokens

All input to and output from the Gemini API is tokenized, including text, images, and other files. You can determine token counts in two main ways:

1.  **Before Sending:** Call `ai.models.countTokens()`. This returns the token count for the **input only**. This is useful for checking if your request is within the model's context limit.
2.  **After Sending:** Access the `usageMetadata` attribute on the response object from a `generateContent` or `sendMessage` call. This provides a detailed breakdown:
    -   `promptTokenCount`: Tokens in your input.
    -   `candidatesTokenCount`: Tokens in the model's output.
    -   `totalTokenCount`: The sum of input and output tokens.
    -   `thoughtsTokenCount`: (For thinking models like Gemini 2.5 Flash) The number of tokens used for internal reasoning.

---

### Counting Text Tokens

Here’s how you can count tokens for a simple text prompt.

```javascript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const prompt = "The quick brown fox jumps over the lazy dog.";

// 1. Count tokens before sending
const { totalTokens } = await ai.models.countTokens({
  model: "gemini-2.5-flash",
  contents: prompt,
});
console.log('Input Token Count:', totalTokens); // Output: 10

// 2. Get usage metadata after generation
const generateResponse = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
});
console.log(generateResponse.usageMetadata);
// Example Output:
// {
//   promptTokenCount: 10,
//   candidatesTokenCount: 50,
//   totalTokenCount: 60,
//   thoughtsTokenCount: 25
// }
```

### Counting Chat (Multi-turn) Tokens

For chat conversations, you can count the tokens for the entire history.

```javascript
import { GoogleGenAI, Chat } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const history = [
  { role: "user", parts: [{ text: "Hi my name is Bob" }] },
  { role: "model", parts: [{ text: "Hi Bob!" }] },
];

const chat: Chat = ai.chats.create({
  model: "gemini-2.5-flash",
  history: history,
});

// Count tokens for the current chat history
const { totalTokens } = await ai.models.countTokens({
  model: "gemini-2.5-flash",
  contents: await chat.getHistory(),
});
console.log('History Token Count:', totalTokens);

// Get usage for the next turn
const chatResponse = await chat.sendMessage({
  message: "In one sentence, explain how a computer works to a young child.",
});
console.log(chatResponse.usageMetadata);
```

### Counting Multimodal Tokens (Images)

Non-text inputs are also converted to tokens. For Gemini 2.0+, small images (with both dimensions <= 384 pixels) are counted as 258 tokens. Larger images are processed in tiles, with each tile also counting as 258 tokens.

Here is an example of counting tokens for a text-and-image prompt. Note that `imageBase64` should be a Base64-encoded string of your image data.

```javascript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const prompt = "Tell me about this image";

// This should be a base64 encoded string of your image.
const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const imagePart = {
  inlineData: {
    mimeType: 'image/png',
    data: imageBase64,
  },
};
const textPart = { text: prompt };

// Count tokens for the multimodal input
const { totalTokens } = await ai.models.countTokens({
  model: "gemini-2.5-flash",
  contents: { parts: [textPart, imagePart] },
});
console.log('Multimodal Token Count:', totalTokens);

// Get usage metadata after generation
const generateResponse = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: { parts: [textPart, imagePart] },
});
console.log(generateResponse.usageMetadata);
```

### System Instructions and Tools

System instructions and tool definitions also contribute to the input token count. Be mindful of this when crafting complex agents, as a long system prompt or many function declarations will increase the token usage for every API call.
