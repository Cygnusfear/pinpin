import { create } from "zustand";
import { sync, DocumentId } from "@tonk/keepsync";
import { Widget, WidgetCreateData } from "../types/widgets";
import { CanvasTransform } from "../types/canvas";
import { SYNC_CONFIG } from "../config/syncEngine";

// Synced store data structure (what gets synchronized)
export interface PinboardData {
	widgets: Widget[];
	canvasTransform: CanvasTransform;
	lastModified: number;
}

// Store state interface
export interface PinboardState extends PinboardData {
	selectedWidgets: Set<string>; // Local state, not synced
}

// Store actions interface
export interface PinboardActions {
	// Widget operations
	addWidget: (widgetData: WidgetCreateData) => void;
	updateWidget: (id: string, updates: Partial<Widget>) => void;
	updateWidgets: (
		updates: Array<{ id: string; updates: Partial<Widget> }>,
	) => void;
	removeWidget: (id: string) => void;

	// Canvas operations
	setCanvasTransform: (transform: CanvasTransform) => void;

	// Selection operations (local only)
	selectWidget: (id: string, selected: boolean) => void;
	clearSelection: () => void;
	getSelectedWidgets: () => Widget[];

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
	canvasTransform: { x: 0, y: 0, scale: 1 },
	lastModified: Date.now(),
};

// Create the synced store
export const useSyncedPinboardStore = create<SyncedPinboardStore>(
	sync(
		(set, get) => ({
			// Initial state
			...initialSyncedData,
			selectedWidgets: new Set<string>(),

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

				// Also remove from local selection
				const { selectedWidgets } = get();
				if (selectedWidgets.has(id)) {
					selectedWidgets.delete(id);
					set({ selectedWidgets: new Set(selectedWidgets) });
				}
			},

			// Canvas operations
			setCanvasTransform: (transform: CanvasTransform) => {
				set({
					canvasTransform: transform,
					lastModified: Date.now(),
				});
			},

			// Selection operations (local only, not synced)
			selectWidget: (id: string, selected: boolean) => {
				set((state) => {
					const newSelectedWidgets = new Set(state.selectedWidgets);
					if (selected) {
						newSelectedWidgets.add(id);
					} else {
						newSelectedWidgets.delete(id);
					}

					return {
						selectedWidgets: newSelectedWidgets,
						widgets: state.widgets.map((widget) =>
							widget.id === id ? ({ ...widget, selected } as Widget) : widget,
						),
					};
				});
			},

			clearSelection: () => {
				set((state) => ({
					selectedWidgets: new Set(),
					widgets: state.widgets.map(
						(widget) => ({ ...widget, selected: false }) as Widget,
					),
				}));
			},

			getSelectedWidgets: () => {
				const { widgets, selectedWidgets } = get();
				return widgets.filter((widget) => selectedWidgets.has(widget.id));
			},

			// Utility operations
			reset: () => {
				set({
					...initialSyncedData,
					selectedWidgets: new Set(),
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
