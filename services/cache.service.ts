import { get, set, del, clear, keys } from 'idb-keyval';

interface CacheItem<T> {
    expiry: number;
    value: T;
}

class CacheService {
    async get<T>(key: string): Promise<T | null> {
        try {
            const item = await get<CacheItem<T>>(key);
            if (!item) {
                return null;
            }
            if (Date.now() > item.expiry) {
                await del(key);
                return null;
            }
            return item.value;
        } catch (error) {
            console.error(`CacheService: Failed to get item for key "${key}":`, error);
            return null;
        }
    }

    async set<T>(key: string, value: T, ttl_ms: number = 24 * 60 * 60 * 1000): Promise<void> { // Default TTL: 24 hours
        try {
            const item: CacheItem<T> = {
                value,
                expiry: Date.now() + ttl_ms,
            };
            await set(key, item);
            
            const allKeys = await keys();
            if (allKeys.length > 100) {
                // Simple capping strategy: remove the first key found if cache exceeds size.
                await del(allKeys[0]); 
            }
        } catch (error) {
            console.error(`CacheService: Failed to set item for key "${key}":`, error);
        }
    }
    
    async has(key: string): Promise<boolean> {
        try {
            const item = await get<CacheItem<any>>(key);
            if (!item) return false;
            
            if (Date.now() > item.expiry) {
                await del(key);
                return false;
            }
            return true;
        } catch (error) {
            console.error(`CacheService: Failed to check item for key "${key}":`, error);
            return false;
        }
    }

    async remove(key: string): Promise<void> {
        try {
            await del(key);
        } catch (error) {
            console.error(`CacheService: Failed to remove item for key "${key}":`, error);
        }
    }

    async clear(): Promise<void> {
        try {
            await clear();
            console.log("Cache cleared.");
            alert("Generation cache has been cleared.");
        } catch (error) {
            console.error("CacheService: Failed to clear cache:", error);
            alert("Failed to clear cache.");
        }
    }
}

export const cacheService = new CacheService();