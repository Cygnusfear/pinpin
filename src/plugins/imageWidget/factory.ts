import {
	WidgetFactory,
	WidgetCreateData,
	WidgetValidationResult,
	WidgetCapabilities,
	WidgetExportData,
	WidgetSerializationOptions,
} from "../../types/widgets";
import { ImageWidget, ImageWidgetCreateData } from "./types";
import { getGenericWidgetFactory } from "../../core/GenericWidgetFactory";

export class ImageWidgetFactory implements WidgetFactory<ImageWidget> {
	type = "image";

	canHandle(data: any): boolean {
		// Handle File objects
		if (data instanceof File) {
			return data.type.startsWith("image/");
		}

		// Handle URLs
		if (typeof data === "string") {
			try {
				const url = new URL(data);
				const pathname = url.pathname.toLowerCase();
				return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/.test(pathname);
			} catch {
				return false;
			}
		}

		// Handle data URLs
		if (typeof data === "string" && data.startsWith("data:image/")) {
			return true;
		}

		// Handle objects with image properties
		if (typeof data === "object" && data !== null) {
			return "src" in data || "url" in data || "image" in data;
		}

		return false;
	}

	async create(
		data: any,
		position: { x: number; y: number },
	): Promise<WidgetCreateData<ImageWidget>> {
		let src: string;
		let alt: string | undefined;
		let originalDimensions = { width: 200, height: 150 }; // Default size

		if (data instanceof File) {
			// Convert File to data URL
			src = await this.fileToDataUrl(data);
			alt = data.name;
			originalDimensions = await this.getImageDimensions(src);
		} else if (typeof data === "string") {
			src = data;
			// For string URLs, try to extract a meaningful alt text from the URL
			try {
				const url = new URL(data);
				alt = url.pathname.split("/").pop() || "Image";
			} catch {
				alt = "Image";
			}
			originalDimensions = await this.getImageDimensions(src);
		} else if (typeof data === "object") {
			src = data.src || data.url || data.image;
			alt = data.alt || data.title || data.name;
			if (data.width && data.height) {
				originalDimensions = { width: data.width, height: data.height };
			} else {
				originalDimensions = await this.getImageDimensions(src);
			}
		} else {
			throw new Error("Invalid image data provided");
		}

		// Calculate display size (max 300px, maintain aspect ratio)
		const maxSize = 300;
		const aspectRatio = originalDimensions.width / originalDimensions.height;
		const displayWidth = aspectRatio > 1 ? maxSize : maxSize * aspectRatio;
		const displayHeight = aspectRatio > 1 ? maxSize / aspectRatio : maxSize;

		// Get default widget data from GenericWidgetFactory
		const genericFactory = getGenericWidgetFactory();
		const defaultData = genericFactory.getDefaultWidgetData(
			"image",
			position,
			{ width: displayWidth, height: displayHeight }
		);

		// Merge with image-specific data
		const widgetData: WidgetCreateData<ImageWidget> = {
			...defaultData,
			src,
			originalDimensions,
		} as WidgetCreateData<ImageWidget>;

		// Only include alt if it has a meaningful value
		if (alt && alt.trim() !== "") {
			widgetData.alt = alt;
		}

		// Only include metadata properties if they have meaningful values
		if (data instanceof File) {
			if (data.name) widgetData.metadata.originalFile = data.name;
			if (data.size) widgetData.metadata.fileSize = data.size;
			if (data.type) widgetData.metadata.mimeType = data.type;
		}

		return widgetData;
	}

	validate(widget: ImageWidget): WidgetValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!widget.src) {
			errors.push("Image source is required");
		}

		if (widget.width <= 0 || widget.height <= 0) {
			errors.push("Image dimensions must be positive");
		}

		if (
			widget.originalDimensions.width <= 0 ||
			widget.originalDimensions.height <= 0
		) {
			warnings.push("Original dimensions are invalid");
		}

		// Check if image URL is accessible (basic validation)
		if (
			widget.src &&
			!widget.src.startsWith("data:") &&
			!this.isValidUrl(widget.src)
		) {
			warnings.push("Image URL may not be accessible");
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	async serialize(
		widget: ImageWidget,
		options: WidgetSerializationOptions,
	): Promise<WidgetExportData> {
		const exportData: WidgetExportData = {
			widget: { ...widget },
		};

		if (options.includeContent && widget.src.startsWith("data:")) {
			// Extract embedded image data
			exportData.assets = [
				{
					id: `${widget.id}-image`,
					type: "image",
					data: widget.src,
					mimeType: this.extractMimeTypeFromDataUrl(widget.src),
				},
			];
		}

		return exportData;
	}

	async deserialize(data: WidgetExportData): Promise<ImageWidget> {
		let widget = data.widget as ImageWidget;

		// Restore image data from assets if needed
		if (data.assets && data.assets.length > 0) {
			const imageAsset = data.assets.find((asset) => asset.type === "image");
			if (imageAsset) {
				widget = {
					...widget,
					src: imageAsset.data as string,
				};
			}
		}

		return widget;
	}

	getDefaultSize(): { width: number; height: number } {
		return { width: 200, height: 150 };
	}

	getCapabilities(): WidgetCapabilities {
		return {
			canResize: true,
			canRotate: true,
			canEdit: false,
			canConfigure: true,
			canGroup: true,
			canDuplicate: true,
			canExport: true,
			hasContextMenu: true,
			hasToolbar: true,
			hasInspector: true,
		};
	}

	// Helper methods
	private async fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	private async getImageDimensions(
		src: string,
	): Promise<{ width: number; height: number }> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				resolve({ width: img.naturalWidth, height: img.naturalHeight });
			};
			img.onerror = () => {
				// Fallback to default dimensions
				resolve({ width: 200, height: 150 });
			};
			img.src = src;
		});
	}

	private isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	private extractMimeTypeFromDataUrl(dataUrl: string): string {
		const match = dataUrl.match(/^data:([^;]+);/);
		return match ? match[1] : "application/octet-stream";
	}
}
