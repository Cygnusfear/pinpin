import { configureSyncEngine } from "@tonk/keepsync";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

// Environment-specific sync engine configuration
export const initializeSyncEngine = () => {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/sync`;
  const wsAdapter = new BrowserWebSocketClientAdapter(wsUrl);
  const storage = new IndexedDBStorageAdapter();

  const url =
    window.location.host.indexOf("localhost") === 0
      ? "http://localhost:7777"
      : `${window.location.protocol}//${window.location.host}`;

  try {
    configureSyncEngine({
      url,
      network: [wsAdapter as any],
      storage,
    });
    
    console.log('Sync engine initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize sync engine:', error);
    return false;
  }
};

// Sync configuration constants
export const SYNC_CONFIG = {
  DOCUMENT_ID: 'pinboard-main',
  INIT_TIMEOUT: 30000,
  RETRY_DELAY: 5000,
  MAX_RETRIES: 3,
} as const;