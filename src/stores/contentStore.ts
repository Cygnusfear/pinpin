import { create } from "zustand";
import { sync, DocumentId } from "@tonk/keepsync";
import { ContentData, ContentHash, ContentDataCreateData, ContentDataUpdateData } from "../types/separatedWidgets";

// ============================================================================
// CONTENT STORE DATA STRUCTURE
// ============================================================================

export interface ContentStoreData {
  content: Record<string, ContentData>; // Hash -> ContentData
  lastModified: number;
}

// ============================================================================
// CONTENT STORE STATE AND ACTIONS
// ============================================================================

export interface ContentStoreState extends ContentStoreData {
  // Cache management
  cacheStats: {
    totalSize: number;
    itemCount: number;
    hitRate: number;
    lastCleanup: number;
  };
}

export interface ContentStoreActions {
  // Content operations
  addContent: (contentData: ContentDataCreateData) => Promise<string>; // Returns content hash
  getContent: (contentId: string) => ContentData | null;
  updateContent: (contentId: string, updates: Partial<ContentData>) => void;
  removeContent: (contentId: string) => void;
  
  // Batch operations
  addMultipleContent: (contentDataArray: ContentDataCreateData[]) => Promise<string[]>;
  getMultipleContent: (contentIds: string[]) => Record<string, ContentData | null>;
  
  // Cache management
  preloadContent: (contentIds: string[]) => Promise<void>;
  evictContent: (contentIds: string[]) => void;
  cleanupCache: () => void;
  getCacheStats: () => ContentStoreState['cacheStats'];
  
  // Utility operations
  reset: () => void;
  getContentByType: (type: string) => ContentData[];
  findDuplicateContent: (contentData: ContentDataCreateData) => string | null;
}

export type ContentStore = ContentStoreState & ContentStoreActions;

// ============================================================================
// CONTENT HASHING AND DEDUPLICATION
// ============================================================================

/**
 * Generate a hash for content data to enable deduplication
 */
function generateContentHash(contentData: ContentDataCreateData): ContentHash {
  // Create a stable string representation for hashing
  const hashInput = JSON.stringify(contentData, Object.keys(contentData).sort());
  
  // Simple hash function (in production, consider using crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const hashString = `content_${Math.abs(hash).toString(36)}_${Date.now()}`;
  
  // Estimate content size
  const size = new Blob([hashInput]).size;
  
  return { hash: hashString, size };
}

/**
 * Check if two content data objects are equivalent for deduplication
 */
function areContentDataEquivalent(a: ContentDataCreateData, b: ContentDataCreateData): boolean {
  if (a.type !== b.type) return false;
  
  // Deep comparison of content (excluding timestamps)
  const aClean = { ...a };
  const bClean = { ...b };
  
  return JSON.stringify(aClean, Object.keys(aClean).sort()) === 
         JSON.stringify(bClean, Object.keys(bClean).sort());
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

const CACHE_CONFIG = {
  MAX_SIZE_MB: 100, // Maximum cache size in MB
  MAX_ITEMS: 1000, // Maximum number of cached items
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  LRU_THRESHOLD: 0.8, // Start LRU eviction when cache is 80% full
};

class ContentCache {
  private accessTimes = new Map<string, number>();
  private totalSize = 0;
  
  updateAccess(contentId: string): void {
    this.accessTimes.set(contentId, Date.now());
  }
  
  addItem(contentId: string, size: number): void {
    this.accessTimes.set(contentId, Date.now());
    this.totalSize += size;
  }
  
  removeItem(contentId: string, size: number): void {
    this.accessTimes.delete(contentId);
    this.totalSize = Math.max(0, this.totalSize - size);
  }
  
  shouldEvict(): boolean {
    const sizeMB = this.totalSize / (1024 * 1024);
    return sizeMB > CACHE_CONFIG.MAX_SIZE_MB * CACHE_CONFIG.LRU_THRESHOLD ||
           this.accessTimes.size > CACHE_CONFIG.MAX_ITEMS * CACHE_CONFIG.LRU_THRESHOLD;
  }
  
  getLRUItems(count: number): string[] {
    return Array.from(this.accessTimes.entries())
      .sort(([, a], [, b]) => a - b) // Sort by access time (oldest first)
      .slice(0, count)
      .map(([id]) => id);
  }
  
  getStats() {
    return {
      totalSize: this.totalSize,
      itemCount: this.accessTimes.size,
      sizeMB: this.totalSize / (1024 * 1024),
    };
  }
  
  clear(): void {
    this.accessTimes.clear();
    this.totalSize = 0;
  }
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

// Initial content store data
const initialContentData: ContentStoreData = {
  content: {},
  lastModified: Date.now(),
};

// Cache instance
const contentCache = new ContentCache();

// Create the content store with sync
export const useContentStore = create<ContentStore>(
  sync(
    (set, get) => ({
      // Initial state
      ...initialContentData,
      cacheStats: {
        totalSize: 0,
        itemCount: 0,
        hitRate: 0,
        lastCleanup: Date.now(),
      },

      // Content operations
      addContent: async (contentData: ContentDataCreateData): Promise<string> => {
        const state = get();
        
        // Check for existing duplicate content
        const existingId = state.findDuplicateContent(contentData);
        if (existingId) {
          console.log("🔄 Content deduplication: reusing existing content", existingId);
          contentCache.updateAccess(existingId);
          return existingId;
        }
        
        // Generate hash and create new content
        const { hash, size } = generateContentHash(contentData);
        const now = Date.now();
        
        const newContent: ContentData = {
          ...contentData,
          id: hash,
          lastModified: now,
          size,
        } as any;
        
        console.log("📦 Adding new content:", hash, `(${size} bytes)`);
        
        set((state) => ({
          content: {
            ...state.content,
            [hash]: newContent,
          },
          lastModified: now,
          cacheStats: {
            ...state.cacheStats,
            totalSize: state.cacheStats.totalSize + size,
            itemCount: state.cacheStats.itemCount + 1,
          },
        }));
        
        // Update cache
        contentCache.addItem(hash, size);
        
        // Check if cache cleanup is needed
        if (contentCache.shouldEvict()) {
          get().cleanupCache();
        }
        
        return hash;
      },

      getContent: (contentId: string): ContentData | null => {
        const state = get();
        const content = state.content[contentId];
        
        if (content) {
          contentCache.updateAccess(contentId);
        }
        
        return content || null;
      },

      updateContent: (contentId: string, updates: Partial<ContentData>): void => {
        const now = Date.now();
        
        set((state) => {
          const existingContent = state.content[contentId];
          if (!existingContent) {
            console.warn("⚠️ Attempted to update non-existent content:", contentId);
            return state;
          }
          
          const updatedContent = {
            ...existingContent,
            ...updates,
            lastModified: now,
          };
          
          return {
            content: {
              ...state.content,
              [contentId]: updatedContent,
            },
            lastModified: now,
          };
        });
        
        contentCache.updateAccess(contentId);
      },

      removeContent: (contentId: string): void => {
        set((state) => {
          const content = state.content[contentId];
          if (!content) return state;
          
          const { [contentId]: removed, ...remainingContent } = state.content;
          
          return {
            content: remainingContent,
            lastModified: Date.now(),
            cacheStats: {
              ...state.cacheStats,
              totalSize: Math.max(0, state.cacheStats.totalSize - (content.size || 0)),
              itemCount: Math.max(0, state.cacheStats.itemCount - 1),
            },
          };
        });
        
        contentCache.removeItem(contentId, get().content[contentId]?.size || 0);
      },

      // Batch operations
      addMultipleContent: async (contentDataArray: ContentDataCreateData[]): Promise<string[]> => {
        const results: string[] = [];
        
        for (const contentData of contentDataArray) {
          const contentId = await get().addContent(contentData);
          results.push(contentId);
        }
        
        return results;
      },

      getMultipleContent: (contentIds: string[]): Record<string, ContentData | null> => {
        const result: Record<string, ContentData | null> = {};
        
        for (const contentId of contentIds) {
          result[contentId] = get().getContent(contentId);
        }
        
        return result;
      },

      // Cache management
      preloadContent: async (contentIds: string[]): Promise<void> => {
        // In a real implementation, this might fetch content from remote storage
        // For now, we just update access times for existing content
        contentIds.forEach(contentId => {
          if (get().content[contentId]) {
            contentCache.updateAccess(contentId);
          }
        });
      },

      evictContent: (contentIds: string[]): void => {
        contentIds.forEach(contentId => {
          get().removeContent(contentId);
        });
      },

      cleanupCache: (): void => {
        const cacheStats = contentCache.getStats();
        
        if (contentCache.shouldEvict()) {
          const evictCount = Math.ceil(cacheStats.itemCount * 0.2); // Evict 20% of items
          const lruItems = contentCache.getLRUItems(evictCount);
          
          console.log(`🧹 Cache cleanup: evicting ${lruItems.length} items`);
          get().evictContent(lruItems);
        }
        
        set((state) => ({
          cacheStats: {
            ...state.cacheStats,
            lastCleanup: Date.now(),
            ...contentCache.getStats(),
          },
        }));
      },

      getCacheStats: () => {
        return get().cacheStats;
      },

      // Utility operations
      reset: (): void => {
        set({
          ...initialContentData,
          lastModified: Date.now(),
          cacheStats: {
            totalSize: 0,
            itemCount: 0,
            hitRate: 0,
            lastCleanup: Date.now(),
          },
        });
        contentCache.clear();
      },

      getContentByType: (type: string): ContentData[] => {
        const state = get();
        return Object.values(state.content).filter(content => content.type === type);
      },

      findDuplicateContent: (contentData: ContentDataCreateData): string | null => {
        const state = get();
        
        for (const [contentId, existingContent] of Object.entries(state.content)) {
          if (areContentDataEquivalent(contentData, existingContent)) {
            return contentId;
          }
        }
        
        return null;
      },
    }),
    {
      docId: "pinboard-content" as DocumentId, // Keep separate document but fix sync config
      initTimeout: 10000, // Increase timeout for content sync
      onInitError: (error) => {
        console.error("❌ [CROSS-DEVICE DEBUG] Content store sync initialization error:", error);
        console.error("🔍 [CROSS-DEVICE DEBUG] This will prevent content from syncing between devices!");
        console.error("🔧 [CROSS-DEVICE DEBUG] Attempting to reinitialize content sync...");
        
        // Attempt to reinitialize after a delay
        setTimeout(() => {
          try {
            console.log("🔄 [CROSS-DEVICE DEBUG] Retrying content store initialization...");
          } catch (retryError) {
            console.error("❌ [CROSS-DEVICE DEBUG] Content store retry failed:", retryError);
          }
        }, 2000);
      },
      onBeforeSync: (data: any) => {
        console.log("📤 [CROSS-DEVICE DEBUG] About to sync content data:", Object.keys(data.content || {}).length, "items");
        console.log("🔍 [CROSS-DEVICE DEBUG] Content IDs being synced:", Object.keys(data.content || {}));
        return data;
      },
      onAfterSync: (data: any) => {
        console.log("📥 [CROSS-DEVICE DEBUG] Content data synced from remote:", Object.keys(data.content || {}).length, "items");
        console.log("🔍 [CROSS-DEVICE DEBUG] Received content IDs:", Object.keys(data.content || {}));
      },
      onSyncError: (error: any) => {
        console.error("❌ [CROSS-DEVICE DEBUG] Content sync error:", error);
        console.error("🔍 [CROSS-DEVICE DEBUG] Content will not be available on other devices!");
      },
    } as any,
  ),
);

// ============================================================================
// HELPER HOOKS AND UTILITIES
// ============================================================================

/**
 * Hook for content operations
 */
export const useContentOperations = () => {
  const addContent = useContentStore(state => state.addContent);
  const getContent = useContentStore(state => state.getContent);
  const updateContent = useContentStore(state => state.updateContent);
  const removeContent = useContentStore(state => state.removeContent);
  const addMultipleContent = useContentStore(state => state.addMultipleContent);
  const getMultipleContent = useContentStore(state => state.getMultipleContent);
  
  return {
    addContent,
    getContent,
    updateContent,
    removeContent,
    addMultipleContent,
    getMultipleContent,
  };
};

/**
 * Hook for cache management
 */
export const useContentCache = () => {
  const preloadContent = useContentStore(state => state.preloadContent);
  const evictContent = useContentStore(state => state.evictContent);
  const cleanupCache = useContentStore(state => state.cleanupCache);
  const getCacheStats = useContentStore(state => state.getCacheStats);
  
  return {
    preloadContent,
    evictContent,
    cleanupCache,
    getCacheStats,
  };
};

// ============================================================================
// AUTOMATIC CACHE CLEANUP
// ============================================================================

// Set up automatic cache cleanup
setInterval(() => {
  const store = useContentStore.getState();
  store.cleanupCache();
}, CACHE_CONFIG.CLEANUP_INTERVAL_MS);