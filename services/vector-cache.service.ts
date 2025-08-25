
import { get, set, del, keys, clear } from 'idb-keyval';
import { StagedFile } from './github.service';
import { chunkText } from '../lib/text';
import { embeddingService } from './embedding.service';

interface VectorChunk {
    id: string; // e.g., 'path/to/file.ts-0'
    filePath: string;
    text: string;
    embedding: number[];
}

const getStoreKey = (filePath: string) => `vector-chunk::${filePath}`;

class VectorCacheService {

    async addFile(
        file: StagedFile,
        onProgress?: (progress: { processed: number; total: number }) => void
    ): Promise<void> {
        try {
            const chunks = chunkText(file.content);
            if (chunks.length === 0) return;
            
            const embeddings = await embeddingService.getEmbeddings(chunks, 'RETRIEVAL_DOCUMENT', onProgress);
            
            const vectorChunks: VectorChunk[] = chunks.map((chunk, index) => ({
                id: `${file.path}-${index}`,
                filePath: file.path,
                text: chunk,
                embedding: embeddings[index],
            }));

            await set(getStoreKey(file.path), vectorChunks);
            console.log(`VectorCache: Indexed ${vectorChunks.length} chunks for ${file.path}.`);
        } catch (error) {
            console.error(`VectorCache: Failed to add file ${file.path}:`, error);
        }
    }
    
    async removeFile(filePath: string): Promise<void> {
        try {
            await del(getStoreKey(filePath));
            console.log(`VectorCache: Removed chunks for ${filePath}.`);
        } catch (error) {
            console.error(`VectorCache: Failed to remove file ${filePath}:`, error);
        }
    }

    private async _getAllChunks(): Promise<VectorChunk[]> {
        const allKeys = await keys();
        const chunkKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith('vector-chunk::'));
        const allChunkArrays = await Promise.all(chunkKeys.map(key => get<VectorChunk[]>(key)));
        return allChunkArrays.flat().filter(Boolean) as VectorChunk[];
    }
    
    async getIndexedFilePaths(): Promise<Set<string>> {
        const allKeys = await keys();
        const chunkKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith('vector-chunk::'));
        const filePaths = new Set(chunkKeys.map(key => key.replace('vector-chunk::', '')));
        return filePaths;
    }

    private _cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async search(queryVector: number[], topK: number = 5): Promise<VectorChunk[]> {
        try {
            const allChunks = await this._getAllChunks();
            if (allChunks.length === 0) return [];

            const scoredChunks = allChunks.map(chunk => ({
                chunk,
                score: this._cosineSimilarity(queryVector, chunk.embedding),
            }));

            return scoredChunks
                .sort((a, b) => b.score - a.score)
                .slice(0, topK)
                .map(item => item.chunk);
        } catch (error) {
            console.error('VectorCache: Search failed:', error);
            return [];
        }
    }

    async clear(): Promise<void> {
        try {
            const allKeys = await keys();
            const chunkKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith('vector-chunk::'));
            await Promise.all(chunkKeys.map(key => del(key)));
            console.log("VectorCache: Cleared all indexed chunks.");
        } catch (error) {
            console.error("VectorCache: Failed to clear cache:", error);
        }
    }
}

export const vectorCacheService = new VectorCacheService();
