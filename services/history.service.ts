import { FunctionCall } from "@google/genai";

export interface HistoryEntry {
    id: string;
    author: 'user' | 'ai';
    content: string;
    thoughts?: string;
    agentName?: string;
    functionCall?: FunctionCall;
}

const HISTORY_STORAGE_KEY = 'devkit-ai-pro-history';

class HistoryService {
    private history: HistoryEntry[] = [];

    constructor() {
        this.loadHistory();
    }

    private loadHistory() {
        try {
            const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (storedHistory) {
                this.history = JSON.parse(storedHistory);
            }
        } catch (error) {
            console.error("Failed to load history from localStorage:", error);
            this.history = [];
        }
    }

    private saveHistory() {
        try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
        } catch (error) {
            console.error("Failed to save history to localStorage:", error);
        }
    }

    getHistory(): HistoryEntry[] {
        return [...this.history];
    }

    addEntry(entry: HistoryEntry) {
        this.history.push(entry);
        this.saveHistory();
    }
    
    clearHistory() {
        this.history = [];
        this.saveHistory();
    }
}

export const historyService = new HistoryService();
