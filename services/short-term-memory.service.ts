
import { HistoryEntry } from './history.service';

const MAX_STM_LENGTH = 20; // Keep the last 10 turns (user + ai)

class ShortTermMemoryService {
    private history: HistoryEntry[] = [];

    addEntry(entry: HistoryEntry) {
        this.history.push(entry);
        if (this.history.length > MAX_STM_LENGTH) {
            this.history.shift(); // Remove the oldest entry
        }
    }

    getHistory(lastN?: number): HistoryEntry[] {
        if (lastN) {
            return this.history.slice(-lastN);
        }
        return [...this.history];
    }

    clear() {
        this.history = [];
        console.log("Short-term memory cleared.");
    }
}

export const shortTermMemoryService = new ShortTermMemoryService();
