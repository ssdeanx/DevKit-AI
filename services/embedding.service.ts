import { geminiService } from './gemini.service';
import { backOff } from 'exponential-backoff';
import { normalize } from '../lib/text';

type TaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING' | 'CODE_RETRIEVAL_QUERY';

class EmbeddingService {
    private readonly BATCH_SIZE = 100;

    async getEmbeddings(
        texts: string[],
        taskType: TaskType,
        onProgress?: (progress: { processed: number; total: number }) => void
    ): Promise<number[][]> {
        const allEmbeddings: number[][] = [];
        const totalBatches = Math.ceil(texts.length / this.BATCH_SIZE);

        for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
            const batch = texts.slice(i, i + this.BATCH_SIZE);
            
            const operation = () => geminiService.embedContents({
                contents: batch,
                config: {
                    taskType: taskType,
                }
            });

            try {
                const response = await backOff(operation, {
                    numOfAttempts: 5,
                    retry: (e: any, attemptNumber: number) => {
                        console.warn(`Embedding batch attempt ${attemptNumber} failed. Retrying...`, e);
                        return e && e.type === 'retriable';
                    },
                });
                const embeddings = response.embeddings.map(e => e.values);
                const normalizedEmbeddings = embeddings.map(e => normalize(e));
                allEmbeddings.push(...normalizedEmbeddings);

                if (onProgress) {
                    onProgress({ processed: i / this.BATCH_SIZE + 1, total: totalBatches });
                }

            } catch (error) {
                console.error("Embedding batch failed after multiple retries:", error);
                throw error;
            }
        }
        return allEmbeddings;
    }

    async getEmbedding(text: string, taskType: TaskType): Promise<number[]> {
        const embeddings = await this.getEmbeddings([text], taskType);
        return embeddings[0];
    }
}

export const embeddingService = new EmbeddingService();