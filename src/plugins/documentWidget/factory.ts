import type {
  WidgetCapabilities,
  WidgetCreateData,
  WidgetExportData,
  WidgetFactory,
  WidgetSerializationOptions,
  WidgetValidationResult,
} from "../../types/widgets";
import type { DocumentWidget } from "./types";

export class DocumentWidgetFactory implements WidgetFactory<DocumentWidget> {
  type = "document";

  private readonly supportedTypes = [
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/xml",
    "text/xml",
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "text/typescript",
    "application/typescript",
    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/x-tar",
    "application/gzip",
    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",
    // Video
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/avi",
    "video/mov",
    "video/wmv",
    // Other
    "application/octet-stream",
  ];

  canHandle(data: any): boolean {
    // Handle File objects
    if (data instanceof File) {
      return (
        this.supportedTypes.includes(data.type) ||
        data.type === "" || // Unknown file type
        !data.type.startsWith("image/")
      ); // Not an image
    }

    // Handle objects with file properties
    if (typeof data === "object" && data !== null) {
      return "file" in data || "document" in data || "attachment" in data;
    }

    return false;
  }

  async create(
    data: any,
    position: { x: number; y: number },
  ): Promise<WidgetCreateData<DocumentWidget>> {
    let fileName: string;
    let fileType: string;
    let fileSize: number | undefined;
    let mimeType: string;
    let content: string | undefined;
    let thumbnail: string | undefined;
    let downloadUrl: string | undefined;
    let previewUrl: string | undefined;

    if (data instanceof File) {
      fileName = data.name;
      fileType = this.getFileTypeFromName(data.name) || "document";
      fileSize = data.size;
      mimeType = data.type || "application/octet-stream";

      // For text files, read content
      if (this.isTextFile(data)) {
        try {
          content = await this.readFileAsText(data);
        } catch (error) {
          console.warn("Failed to read file content:", error);
          content = undefined;
        }
      }

      // Create data URL for download
      try {
        downloadUrl = await this.fileToDataUrl(data);
      } catch (error) {
        console.error("Failed to create data URL for file:", error);
        downloadUrl = undefined;
      }

      // Generate thumbnail based on file type
      thumbnail = this.generateThumbnail(fileType, mimeType);
    } else if (typeof data === "object") {
      fileName = data.fileName || data.name || "Unknown Document";
      fileType = data.fileType || data.type || "document";
      fileSize = data.fileSize || data.size;
      mimeType = data.mimeType || data.type || "application/octet-stream";
      content = data.content;
      thumbnail = data.thumbnail;
      downloadUrl = data.downloadUrl || data.url;
      previewUrl = data.previewUrl;
    } else {
      throw new Error("Invalid document data provided");
    }

    // Calculate size based on file type
    const size = this.calculateDocumentSize(fileType, content);

    return {
      type: "document",
      fileName,
      fileType,
      fileSize,
      mimeType,
      content,
      thumbnail,
      downloadUrl,
      previewUrl,
      x: position.x - size.width / 2,
      y: position.y - size.height / 2,
      width: size.width,
      height: size.height,
      rotation: (Math.random() - 0.5) * 6, // Slight random rotation
      locked: false,
      metadata: {
        uploadedAt: Date.now(),
        isTextFile: this.isTextFile(data),
        hasPreview: !!previewUrl,
      },
    };
  }

  validate(widget: DocumentWidget): WidgetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.fileName) {
      errors.push("Document file name is required");
    }

    if (!widget.mimeType) {
      errors.push("Document MIME type is required");
    }

    if (widget.width <= 0 || widget.height <= 0) {
      errors.push("Document dimensions must be positive");
    }

    if (widget.fileSize && widget.fileSize > 100 * 1024 * 1024) {
      // 100MB
      warnings.push("Large file size may affect performance");
    }

    if (!widget.downloadUrl && !widget.content) {
      warnings.push("Document has no accessible content or download URL");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async serialize(
    widget: DocumentWidget,
    options: WidgetSerializationOptions,
  ): Promise<WidgetExportData> {
    const exportData: WidgetExportData = {
      widget: { ...widget },
    };

    if (options.includeContent && widget.downloadUrl?.startsWith("data:")) {
      // Extract embedded file data
      exportData.assets = [
        {
          id: `${widget.id}-document`,
          type: "document",
          data: widget.downloadUrl,
          mimeType: widget.mimeType,
        },
      ];
    }

    return exportData;
  }

  async deserialize(data: WidgetExportData): Promise<DocumentWidget> {
    let widget = data.widget as DocumentWidget;

    // Restore document data from assets if needed
    if (data.assets && data.assets.length > 0) {
      const documentAsset = data.assets.find(
        (asset) => asset.type === "document",
      );
      if (documentAsset) {
        widget = {
          ...widget,
          downloadUrl: documentAsset.data as string,
        };
      }
    }

    return widget;
  }

  getDefaultSize(): { width: number; height: number } {
    return { width: 200, height: 100 };
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

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private isTextFile(data: any): boolean {
    if (data instanceof File) {
      return (
        data.type.startsWith("text/") ||
        data.type === "application/json" ||
        data.type === "application/xml" ||
        data.type === "application/javascript" ||
        data.type === "application/typescript" ||
        !!data.name.match(
          /\.(txt|md|json|xml|html|css|js|ts|py|java|cpp|c|h|php|rb|go|rs|swift|kt|scala)$/i,
        )
      );
    }
    return false;
  }

  private getFileTypeFromName(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase();

    const typeMap: Record<string, string> = {
      // Documents
      pdf: "pdf",
      doc: "word",
      docx: "word",
      xls: "excel",
      xlsx: "excel",
      ppt: "powerpoint",
      pptx: "powerpoint",
      rtf: "document",
      txt: "text",
      md: "markdown",
      csv: "spreadsheet",
      json: "code",
      xml: "code",
      html: "code",
      css: "code",
      js: "code",
      ts: "code",
      py: "code",
      java: "code",
      cpp: "code",
      c: "code",
      h: "code",
      php: "code",
      rb: "code",
      go: "code",
      rs: "code",
      swift: "code",
      kt: "code",
      scala: "code",
      // Archives
      zip: "archive",
      rar: "archive",
      "7z": "archive",
      tar: "archive",
      gz: "archive",
      // Media
      mp3: "audio",
      wav: "audio",
      ogg: "audio",
      mp4: "video",
      webm: "video",
      avi: "video",
      mov: "video",
      wmv: "video",
    };

    return typeMap[extension || ""] || "document";
  }

  private generateThumbnail(fileType: string, _mimeType: string): string {
    // Return emoji-based thumbnails for different file types
    const thumbnailMap: Record<string, string> = {
      pdf: "📄",
      word: "📝",
      excel: "📊",
      powerpoint: "📽️",
      text: "📄",
      markdown: "📝",
      code: "💻",
      spreadsheet: "📊",
      archive: "🗜️",
      audio: "🎵",
      video: "🎬",
      document: "📄",
    };

    return thumbnailMap[fileType] || "📄";
  }

  private calculateDocumentSize(
    fileType: string,
    content?: string,
  ): { width: number; height: number } {
    const baseWidth = 200;
    const baseHeight = 250;

    // Adjust size based on file type
    switch (fileType) {
      case "image":
        return { width: 250, height: 200 };
      case "video":
        return { width: 300, height: 200 };
      case "audio":
        return { width: 250, height: 100 };
      case "code":
      case "text":
        if (content && content.length > 500) {
          return { width: 300, height: 350 };
        }
        return { width: 250, height: 200 };
      case "spreadsheet":
        return { width: 280, height: 200 };
      case "archive":
        return { width: 180, height: 220 };
      default:
        return { width: baseWidth, height: baseHeight };
    }
  }
}
