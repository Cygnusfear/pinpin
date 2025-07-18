import { configureSyncEngine, getSyncEngine } from "@tonk/keepsync";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

// Environment-specific sync engine configuration
export const initializeSyncEngine = async () => {
	const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const wsUrl = `${wsProtocol}//${window.location.host}/sync`;
	const wsAdapter = new BrowserWebSocketClientAdapter(wsUrl);
	const storage = new IndexedDBStorageAdapter();

	const url =
		window.location.host.indexOf("localhost") === 0
			? "http://localhost:3000"
			: `${window.location.protocol}//${window.location.host}`;

	try {
		let engine = await getSyncEngine();

		console.warn("engine", engine);

		if (!engine) {
			await configureSyncEngine({
				url,
				network: [wsAdapter as any],
				storage,
			});
			engine = await getSyncEngine();
		}

		await engine.whenReady();

		return true;
	} catch (error) {
		console.error("Failed to initialize sync engine:", error);
		return false;
	}
};

// Sync configuration constants
export const SYNC_CONFIG = {
	DOCUMENT_ID: "pinboard-main",
	INIT_TIMEOUT: 30000,
	RETRY_DELAY: 5000,
	MAX_RETRIES: 3,
} as const;
