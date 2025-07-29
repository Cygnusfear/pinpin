import { useContentStore } from "../../stores/contentStore";
import type {
  WidgetFactory,
  CreateWidgetInput,
  Position,
  WidgetCapabilities,
  HydratedWidget,
} from "../../types/widgets";
import { documentTypeDefinition } from "./index";
import type { DocumentContent } from "./types";

// ============================================================================
// DOCUMENT WIDGET FACTORY - CLEAN IMPLEMENTATION
// ============================================================================

export class DocumentFactory implements WidgetFactory<DocumentContent> {
  type = "document";

  canHandle(data: any): boolean {
    // Handle explicit document requests
    if (data?.type === "document") {
      return true;
    }

    // Handle File objects (but NOT images)
    if (data instanceof File) {
      // Exclude image files - they should be handled by ImageFactory
      if (data.type.startsWith("image/")) {
        return false;
      }
      // Exclude common image extensions
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
      if (imageExtensions.test(data.name)) {
        return false;
      }
      return true;
    }

    // Handle document data objects
    if (
      data &&
      typeof data === "object" &&
      (data.fileName || data.fileType || data.mimeType)
    ) {
      return true;
    }

    // Handle file extensions in URLs or paths
    if (typeof data === "string") {
      const documentExtensions =
        /\.(pdf|doc|docx|txt|md|rtf|odt|ppt|pptx|xls|xlsx|csv)$/i;
      return documentExtensions.test(data);
    }

    return false;
  }

  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let fileName = "Untitled Document";
    let fileType = "document";
    let fileSize = 0;
    let mimeType = "text/plain";
    let content = "";
    let downloadUrl = "";
    let previewUrl = "";
    let thumbnail = "";
    let isFileUpload = false;

    // Extract document data based on input type
    if (data instanceof File) {
      // Handle File objects (from drag & drop) - use Storacha upload
      isFileUpload = true;
      fileName = data.name;
      fileType = this.getFileTypeFromName(data.name);
      fileSize = data.size;
      mimeType = data.type || this.getMimeTypeFromName(data.name);
      downloadUrl = URL.createObjectURL(data); // Temporary local URL for immediate preview

      // For text files, read content
      if (
        data.type.startsWith("text/") ||
        data.name.endsWith(".txt") ||
        data.name.endsWith(".md")
      ) {
        try {
          content = await data.text();
        } catch (error) {
          console.warn("Could not read file content:", error);
        }
      }
    } else if (typeof data === "string") {
      // Handle URL or file path
      fileName = this.extractFileNameFromPath(data);
      fileType = this.getFileTypeFromName(fileName);
      mimeType = this.getMimeTypeFromName(fileName);
      downloadUrl = data.startsWith("http") ? data : "";
    } else if (data && typeof data === "object") {
      fileName = data.fileName || data.name || "Document";
      fileType = data.fileType || this.getFileTypeFromName(fileName);
      fileSize = data.fileSize || data.size || 0;
      mimeType =
        data.mimeType || data.type || this.getMimeTypeFromName(fileName);
      content = data.content || "";
      downloadUrl = data.downloadUrl || data.url || "";
      previewUrl = data.previewUrl || "";
      thumbnail = data.thumbnail || "";
    }

    const documentContent: DocumentContent = {
      fileName,
      fileType,
      fileSize,
      mimeType,
      content,
      thumbnail,
      downloadUrl,
      previewUrl,
      ...(isFileUpload && { isFileUpload: true, originalFile: data }),
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 300,
      height: 200,
      content: documentContent,
    };
  }

  private extractFileNameFromPath(path: string): string {
    try {
      const url = new URL(path);
      const segments = url.pathname.split("/");
      return segments[segments.length - 1] || "Document";
    } catch {
      const segments = path.split("/");
      return segments[segments.length - 1] || "Document";
    }
  }

  private getFileTypeFromName(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return "pdf";
      case "doc":
      case "docx":
        return "word";
      case "ppt":
      case "pptx":
        return "powerpoint";
      case "xls":
      case "xlsx":
        return "excel";
      case "txt":
      case "md":
        return "text";
      case "rtf":
        return "rtf";
      case "odt":
        return "odt";
      case "csv":
        return "csv";
      default:
        return "document";
    }
  }

  private getMimeTypeFromName(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      txt: "text/plain",
      md: "text/markdown",
      rtf: "application/rtf",
      odt: "application/vnd.oasis.opendocument.text",
      csv: "text/csv",
    };

    return mimeTypes[extension || ""] || "application/octet-stream";
  }

  getDefaultSize(): { width: number; height: number } {
    return documentTypeDefinition[0].defaultSize;
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false,
      canEdit: true,
      canConfigure: true,
      canGroup: true,
      canDuplicate: false,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: false,
      hasInspector: true,
    };
  }

  validate(widget: HydratedWidget<DocumentContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Document content is missing");
    } else {
      const data = widget.content.data;
      if (!data.fileName || typeof data.fileName !== "string") {
        errors.push("File name is required and must be a string");
      }
      if (!data.fileType || typeof data.fileType !== "string") {
        errors.push("File type is required and must be a string");
      }
      if (typeof data.fileSize !== "number" || data.fileSize < 0) {
        warnings.push("File size should be a non-negative number");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
