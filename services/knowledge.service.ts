import { get, set, del, clear, keys } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';

export interface Fact {
    id: string;
    content: string;
    source: string; // e.g., 'ResearchAgent'
    timestamp: number;
}

const KNOWLEDGE_BASE_KEY = 'devkit-knowledge-base';

class KnowledgeService {
    
    async addFact(fact: Omit<Fact, 'id' | 'timestamp'>): Promise<void> {
        try {
            const newFact: Fact = {
                id: uuidv4(),
                timestamp: Date.now(),
                ...fact,
            };
            const allFacts = await this.getAllFacts();
            allFacts.push(newFact);
            await set(KNOWLEDGE_BASE_KEY, allFacts);
        } catch (error) {
            console.error("KnowledgeService: Failed to add fact:", error);
        }
    }

    async getAllFacts(): Promise<Fact[]> {
        try {
            const facts = await get<Fact[]>(KNOWLEDGE_BASE_KEY);
            return facts || [];
        } catch (error) {
            console.error("KnowledgeService: Failed to get all facts:", error);
            return [];
        }
    }

    async searchFacts(query: string, maxResults: number = 5): Promise<Fact[]> {
        const allFacts = await this.getAllFacts();
        if (!query.trim() || allFacts.length === 0) return [];

        const queryWords = query.toLowerCase().split(/\s+/);
        
        const scoredFacts = allFacts.map(fact => {
            const content = fact.content.toLowerCase();
            let score = 0;
            queryWords.forEach(word => {
                if (content.includes(word)) {
                    score++;
                }
            });
            return { fact, score };
        });

        return scoredFacts
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(item => item.fact);
    }

    async clearKnowledgeBase(): Promise<void> {
        try {
            await del(KNOWLEDGE_BASE_KEY);
            console.log("Knowledge Base cleared.");
            alert("AI Knowledge Base has been cleared.");
        } catch (error) {
            console.error("KnowledgeService: Failed to clear knowledge base:", error);
            alert("Failed to clear Knowledge Base.");
        }
    }
}

export const knowledgeService = new KnowledgeService();
