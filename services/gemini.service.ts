import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse, Chat } from "@google/genai";

class GeminiService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API_KEY environment variable is not set");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  get client(): GoogleGenAI {
    return this.ai;
  }
  
  async generateContent(params: Omit<GenerateContentParameters, 'model'>): Promise<GenerateContentResponse> {
    const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        ...params
    });
    return response;
  }

  async generateContentStream(params: Omit<GenerateContentParameters, 'model'>) {
    const response = await this.ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        ...params
    });
    return response;
  }

  async generateImages(prompt: string, config: { numberOfImages: number, aspectRatio: string }) {
    const response = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config,
    });
    return response.generatedImages;
  }
}

const API_KEY = process.env.API_KEY;
export const geminiService = new GeminiService(API_KEY!);