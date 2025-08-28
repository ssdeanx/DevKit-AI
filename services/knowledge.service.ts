import { vectorCacheService, SourceType, IndexedSource } from './vector-cache.service';
import { embeddingService } from './embedding.service';

class KnowledgeService {
    
    async addDocument(
        identifier: string,
        type: SourceType,
        content: string,
        onProgress?: (progress: { processed: number; total: number }) => void
    ): Promise<void> {
        if (!identifier || !content) {
            console.warn("KnowledgeService: addDocument called with empty identifier or content.");
            return;
        }
        await vectorCacheService.addSource(identifier, type, content, onProgress);
    }

    async removeDocument(identifier: string): Promise<void> {
        await vectorCacheService.removeSource(identifier);
    }
    
    async getAllDocuments(): Promise<IndexedSource[]> {
        return await vectorCacheService.getIndexedSources();
    }

    async clear(): Promise<void> {
        await vectorCacheService.clear();
    }

}

export const knowledgeService = new KnowledgeService();
export type { IndexedSource };
