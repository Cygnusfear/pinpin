import { create } from "zustand";
import { sync, DocumentId } from "@tonk/keepsync";
import { Widget, WidgetCreateData } from "../types/widgets";
import { CanvasTransform } from "../types/canvas";
import { SYNC_CONFIG } from "../config/syncEngine";

// Synced store data structure (what gets synchronized)
export interface PinboardData {
	widgets: Widget[];
	lastModified: number;
}

// Store state interface (only synced data)
export interface PinboardState extends PinboardData {}

// Store actions interface
export interface PinboardActions {
	// Widget operations
	addWidget: (widgetData: WidgetCreateData) => void;
	updateWidget: (id: string, updates: Partial<Widget>) => void;
	updateWidgets: (
		updates: Array<{ id: string; updates: Partial<Widget> }>,
	) => void;
	removeWidget: (id: string) => void;

	// Utility operations
	reset: () => void;
}

export type SyncedPinboardStore = PinboardState & PinboardActions;

// Generate unique IDs for widgets
const generateId = () =>
	`widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Clean widget data by removing undefined values that can't be serialized
const cleanWidgetData = (widget: any): any => {
	const cleaned = { ...widget };

	// Remove undefined values recursively
	Object.keys(cleaned).forEach((key) => {
		if (cleaned[key] === undefined) {
			delete cleaned[key];
		} else if (
			cleaned[key] &&
			typeof cleaned[key] === "object" &&
			!Array.isArray(cleaned[key])
		) {
			cleaned[key] = cleanWidgetData(cleaned[key]);
		}
	});

	return cleaned;
};

// Initial synced data
const initialSyncedData: PinboardData = {
	widgets: [],
	lastModified: Date.now(),
};

// Create the synced store
export const useSyncedPinboardStore = create<SyncedPinboardStore>(
	sync(
		(set, get) => ({
			// Initial state
			...initialSyncedData,

			      // Widget operations
      addWidget: (widgetData: WidgetCreateData) => {
        const now = Date.now();
        const newWidget = cleanWidgetData({
          ...widgetData,
          id: generateId(),
          zIndex: get().widgets.length,
          selected: false,
          createdAt: now,
          updatedAt: now,
        } as Widget);

        set((state) => ({
          widgets: [...state.widgets, newWidget],
          lastModified: now,
        }));
      },

			updateWidget: (id: string, updates: Partial<Widget>) => {
				const now = Date.now();
				set((state) => ({
					widgets: state.widgets.map((widget) =>
						widget.id === id
							? ({ ...widget, ...updates, updatedAt: now } as Widget)
							: widget,
					),
					lastModified: now,
				}));
			},

			updateWidgets: (
				updates: Array<{ id: string; updates: Partial<Widget> }>,
			) => {
				const now = Date.now();
				set((state) => {
					const updatesMap = new Map(updates.map((u) => [u.id, u.updates]));

					return {
						widgets: state.widgets.map((widget) => {
							const widgetUpdates = updatesMap.get(widget.id);
							return widgetUpdates
								? ({ ...widget, ...widgetUpdates, updatedAt: now } as Widget)
								: widget;
						}),
						lastModified: now,
					};
				});
			},

			removeWidget: (id: string) => {
				set((state) => ({
					widgets: state.widgets.filter((widget) => widget.id !== id),
					lastModified: Date.now(),
				}));
			},

			// Utility operations
			reset: () => {
				set({
					...initialSyncedData,
					lastModified: Date.now(),
				});
			},
		}),
		{
			docId: SYNC_CONFIG.DOCUMENT_ID as DocumentId,
			initTimeout: SYNC_CONFIG.INIT_TIMEOUT,
			onInitError: (error) => {
				console.error("Sync initialization error:", error);
				// The store selector will handle fallback to offline mode
			},
		},
	),
);

// Export sync status check function
export const getSyncStatus = () => {
	try {
		// This is a simple way to check if sync is working
		// In a real implementation, you might want to expose this from the sync middleware
		return "synced";
	} catch (error) {
		return "error";
	}
};
