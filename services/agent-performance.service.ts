

import { get, set, del, keys, clear } from 'idb-keyval';
import { TokenUsage } from '../agents/types';

export interface AgentPerformanceRecord {
    runId: string;
    agentId: string;
    timestamp: number;
    prompt: string;
    tokens: TokenUsage;
    efficiencyScore: number;
    qualityScore: number;
    feedback: 'positive' | 'negative' | null;
    finalScore: number;
}

const getStoreKey = (agentId: string) => `performance::${agentId}`;
const MAX_RECORDS_PER_AGENT = 100;

class AgentPerformanceService {

    async addRecord(
        agentId: string, 
        runId: string,
        prompt: string, 
        tokens: TokenUsage, 
        efficiencyScore: number,
        qualityScore: number
    ): Promise<void> {
        try {
            const newRecord: AgentPerformanceRecord = {
                runId,
                agentId,
                prompt,
                tokens,
                efficiencyScore,
                qualityScore,
                feedback: null,
                finalScore: efficiencyScore * qualityScore, // Initial score
                timestamp: Date.now(),
            };
            const allRecords = await this.getRecords(agentId);
            allRecords.push(newRecord);

            if (allRecords.length > MAX_RECORDS_PER_AGENT) {
                allRecords.sort((a, b) => b.timestamp - a.timestamp).splice(MAX_RECORDS_PER_AGENT);
            }
            
            await set(getStoreKey(agentId), allRecords);
        } catch (error) {
            console.error(`AgentPerformanceService: Failed to add record for agent ${agentId}:`, error);
        }
    }

    async getRecords(agentId: string): Promise<AgentPerformanceRecord[]> {
        try {
            const records = await get<AgentPerformanceRecord[]>(getStoreKey(agentId));
            return (records || []).sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error(`AgentPerformanceService: Failed to get records for agent ${agentId}:`, error);
            return [];
        }
    }

    async getRecord(runId: string): Promise<AgentPerformanceRecord | null> {
        const allKeys = await keys();
        const performanceKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith('performance::'));
        for (const key of performanceKeys) {
            const records = await get<AgentPerformanceRecord[]>(key);
            const record = records?.find(r => r.runId === runId);
            if (record) return record;
        }
        return null;
    }

    async updateFeedback(runId: string, feedback: 'positive' | 'negative'): Promise<void> {
        const record = await this.getRecord(runId);
        if (!record) {
            console.warn(`Performance record with runId ${runId} not found for feedback update.`);
            return;
        }
        
        record.feedback = feedback;
        const feedbackMultiplier = feedback === 'positive' ? 1.2 : 0.5;
        record.finalScore = record.efficiencyScore * record.qualityScore * feedbackMultiplier;

        const allRecords = await this.getRecords(record.agentId);
        const recordIndex = allRecords.findIndex(r => r.runId === runId);
        if (recordIndex !== -1) {
            allRecords[recordIndex] = record;
            await set(getStoreKey(record.agentId), allRecords);
            console.log(`Updated feedback for run ${runId}. New final score: ${record.finalScore.toFixed(2)}`);
        }
    }

    async getAveragePerformance(agentId: string): Promise<{ avgFinalScore: number; runCount: number } | null> {
        const records = await this.getRecords(agentId);
        if (records.length === 0) {
            return null;
        }

        const totalScore = records.reduce((sum, record) => sum + record.finalScore, 0);
        const avgFinalScore = totalScore / records.length;

        return {
            avgFinalScore,
            runCount: records.length,
        };
    }

    async clearAllPerformanceData(): Promise<void> {
        try {
            const allKeys = await keys();
            const performanceKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith('performance::'));
            await Promise.all(performanceKeys.map(key => del(key)));

            console.log("All agent performance data cleared.");
        } catch (error) {
            console.error("AgentPerformanceService: Failed to clear all performance data:", error);
            throw error;
        }
    }
}

export const agentPerformanceService = new AgentPerformanceService();