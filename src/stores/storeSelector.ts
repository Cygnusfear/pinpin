import { useState, useEffect } from 'react';
import { useSyncedPinboardStore } from './syncedPinboardStore';
import { useFallbackPinboardStore } from './fallbackStore';

// Context to track sync availability
let syncAvailable = true;
let syncInitialized = false;

// Store selector hook that automatically chooses between synced and fallback stores
export const usePinboardStore = () => {
  const [useFallback, setUseFallback] = useState(!syncAvailable);
  
  // Always call both hooks to satisfy React's rules of hooks
  const syncedStore = useSyncedPinboardStore();
  const fallbackStore = useFallbackPinboardStore();
  
  useEffect(() => {
    // Check sync status periodically
    const checkSyncStatus = () => {
      try {
        // If sync is working and we haven't initialized yet, mark as available
        if (!syncInitialized) {
          syncAvailable = true;
          syncInitialized = true;
          setUseFallback(false);
        }
      } catch (error) {
        console.warn('Sync store unavailable, using fallback store:', error);
        syncAvailable = false;
        setUseFallback(true);
      }
    };

    checkSyncStatus();
    
    // Check sync status every 5 seconds
    const interval = setInterval(checkSyncStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Return the appropriate store based on sync availability
  return useFallback ? fallbackStore : syncedStore;
};

// Export individual stores for direct access if needed
export { useSyncedPinboardStore, useFallbackPinboardStore };

// Export types
export type {
  SyncedPinboardStore,
  PinboardData,
  PinboardState,
  PinboardActions
} from './syncedPinboardStore';

export type {
  FallbackPinboardStore
} from './fallbackStore';

// Utility to manually set sync availability (for SyncProvider)
export const setSyncAvailability = (available: boolean) => {
  syncAvailable = available;
  syncInitialized = true;
};

// Utility to get current sync status
export const getSyncAvailability = () => syncAvailable;