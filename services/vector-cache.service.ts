import { get, set, del, keys, clear } from 'idb-keyval';
import { StagedFile } from './github.service';
import { chunkText } from '../lib/text';
import { embeddingService } from './embedding.service';

export type SourceType = 'code' | 'chat' | 'web' | 'text';

export interface VectorChunk {
    id: string; // e.g., 'code::path/to/file.ts-0' or 'chat::session123-2'
    sourceType: SourceType;
    sourceIdentifier: string; // file path, session id, url, or manual entry id
    timestamp: number;
    text: string;
    embedding: number[];
}

export interface IndexedSource {
    identifier: string;
    type: SourceType;
}

const getStoreKey = (sourceIdentifier: string) => `vector-chunks::${sourceIdentifier}`;

class VectorCacheService {

    async addSource(
        identifier: string,
        type: SourceType,
        content: string,
        onProgress?: (progress: { processed: number; total: number }) => void
    ): Promise<void> {
        try {
            const chunks = chunkText(content);
            if (chunks.length === 0) return;
            
            const embeddings = await embeddingService.getEmbeddings(chunks, 'RETRIEVAL_DOCUMENT', onProgress);
            
            const vectorChunks: VectorChunk[] = chunks.map((chunk, index) => ({
                id: `${type}::${identifier}-${index}`,
                sourceIdentifier: identifier,
                sourceType: type,
                timestamp: Date.now(),
                text: chunk,
                embedding: embeddings[index],
            }));

            await set(getStoreKey(identifier), vectorChunks);
            console.log(`VectorCache: Indexed ${vectorChunks.length} chunks for ${type} source '${identifier}'.`);
        } catch (error) {
            console.error(`VectorCache: Failed to add source ${identifier}:`, error);
        }
    }
    
    async removeSource(sourceIdentifier: string): Promise<void> {
        try {
            await del(getStoreKey(sourceIdentifier));
            console.log(`VectorCache: Removed chunks for ${sourceIdentifier}.`);
        } catch (error) {
            console.error(`VectorCache: Failed to remove source ${sourceIdentifier}:`, error);
        }
    }

    private async _getAllChunks(): Promise<VectorChunk[]> {
        const allKeys = await keys();
        const chunkKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith('vector-chunks::'));
        const allChunkArrays = await Promise.all(chunkKeys.map(key => get<VectorChunk[]>(key)));
        return allChunkArrays.flat().filter(Boolean) as VectorChunk[];
    }
    
    async getIndexedSources(): Promise<IndexedSource[]> {
        const allKeys = await keys();
        const sources: IndexedSource[] = [];
        const seenIdentifiers = new Set<string>();

        const chunkKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith('vector-chunks::'));
        const allChunkArrays = await Promise.all(chunkKeys.map(key => get<VectorChunk[]>(key)));
        
        const allChunks = allChunkArrays.flat().filter(Boolean) as VectorChunk[];

        for (const chunk of allChunks) {
            if (chunk && !seenIdentifiers.has(chunk.sourceIdentifier)) {
                sources.push({
                    identifier: chunk.sourceIdentifier,
                    type: chunk.sourceType,
                });
                seenIdentifiers.add(chunk.sourceIdentifier);
            }
        }
        return sources;
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
            const chunkKeysToDelete = allKeys.filter((key): key is string => 
                typeof key === 'string' && key.startsWith('vector-chunks::')
            );
            await Promise.all(chunkKeysToDelete.map(key => del(key)));
            console.log("VectorCache: Cleared all indexed chunks.");
        } catch (error) {
            console.error("VectorCache: Failed to clear cache:", error);
        }
    }
}

export const vectorCacheService = new VectorCacheService();