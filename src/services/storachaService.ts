import { create } from "@storacha/client";

// ============================================================================
// STORACHA SERVICE - DECENTRALIZED FILE STORAGE
// ============================================================================

export interface StorachaUploadResult {
  cid: string; // Content Identifier (IPFS hash)
  url: string; // IPFS gateway URL
  size: number;
  filename: string;
}

export interface StorachaUploadProgress {
  uploadId: string;
  progress: number; // 0-100
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface StorachaConfig {
  email?: string;
  space?: string;
  agent?: string;
}

class StorachaService {
  private client: any = null;
  private config: StorachaConfig = {};
  private uploadListeners: Map<string, (progress: StorachaUploadProgress) => void> = new Map();

  /**
   * Initialize the Storacha client
   */
  async initialize(config: StorachaConfig = {}) {
    try {
      // Store config for later use
      this.config = {
        email: config.email || import.meta.env.VITE_STORACHA_EMAIL,
        space: config.space || import.meta.env.VITE_STORACHA_SPACE,
        agent: config.agent || import.meta.env.VITE_STORACHA_AGENT,
        ...config
      };

      // Create the Storacha client
      this.client = await create();
      
      // If we have credentials, authorize
      if (this.config.email) {
        await this.authorize();
      }

      console.log("✅ Storacha client initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize Storacha client:", error);
      return false;
    }
  }

  /**
   * Authorize with Storacha using email
   */
  private async authorize() {
    if (!this.client || !this.config.email) {
      throw new Error("Client not initialized or email not provided");
    }

    try {
      // Note: In a real app, you'd handle the email verification flow
      // For now, we'll assume the client is already authorized
      console.log("🔐 Storacha authorization setup");
    } catch (error) {
      console.error("❌ Storacha authorization failed:", error);
      throw error;
    }
  }

  /**
   * Upload a single file to Storacha
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: StorachaUploadProgress) => void
  ): Promise<StorachaUploadResult> {
    if (!this.client) {
      throw new Error("Storacha client not initialized. Call initialize() first.");
    }

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Register progress listener if provided
      if (onProgress) {
        this.uploadListeners.set(uploadId, onProgress);
      }

      // Notify upload start
      this.notifyProgress(uploadId, 0, 'uploading');

      // Upload the file
      const cid = await this.client.uploadFile(file);
      
      // Notify upload completion
      this.notifyProgress(uploadId, 100, 'completed');

      // Construct IPFS gateway URL
      const url = `https://${cid}.ipfs.w3s.link`;

      const result: StorachaUploadResult = {
        cid: cid.toString(),
        url,
        size: file.size,
        filename: file.name
      };

      console.log("✅ File uploaded to Storacha:", result);
      return result;

    } catch (error) {
      console.error("❌ Storacha upload failed:", error);
      this.notifyProgress(uploadId, 0, 'failed', error.message);
      throw error;
    } finally {
      // Clean up listener
      this.uploadListeners.delete(uploadId);
    }
  }

  /**
   * Upload multiple files to Storacha
   */
  async uploadFiles(
    files: File[],
    onProgress?: (uploadId: string, progress: StorachaUploadProgress) => void
  ): Promise<StorachaUploadResult[]> {
    const results: StorachaUploadResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.uploadFile(file, onProgress ? 
          (progress) => onProgress(progress.uploadId, progress) : undefined);
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload file ${file.name}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Upload a directory of files to Storacha
   */
  async uploadDirectory(
    files: File[],
    onProgress?: (progress: StorachaUploadProgress) => void
  ): Promise<StorachaUploadResult> {
    if (!this.client) {
      throw new Error("Storacha client not initialized. Call initialize() first.");
    }

    const uploadId = `dir_upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Register progress listener if provided
      if (onProgress) {
        this.uploadListeners.set(uploadId, onProgress);
      }

      // Notify upload start
      this.notifyProgress(uploadId, 0, 'uploading');

      // Convert files to the format expected by uploadDirectory
      const fileObjects = files.map(file => ({
        name: file.name,
        stream: () => file.stream()
      }));

      // Upload the directory
      const cid = await this.client.uploadDirectory(fileObjects);
      
      // Notify upload completion
      this.notifyProgress(uploadId, 100, 'completed');

      // Calculate total size
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // Construct IPFS gateway URL
      const url = `https://${cid}.ipfs.w3s.link`;

      const result: StorachaUploadResult = {
        cid: cid.toString(),
        url,
        size: totalSize,
        filename: `directory_${files.length}_files`
      };

      console.log("✅ Directory uploaded to Storacha:", result);
      return result;

    } catch (error) {
      console.error("❌ Storacha directory upload failed:", error);
      this.notifyProgress(uploadId, 0, 'failed', error.message);
      throw error;
    } finally {
      // Clean up listener
      this.uploadListeners.delete(uploadId);
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.client !== null;
  }

  /**
   * Get service status and configuration info
   */
  getStatus() {
    return {
      initialized: this.isReady(),
      config: {
        hasEmail: !!this.config.email,
        hasSpace: !!this.config.space,
        hasAgent: !!this.config.agent
      }
    };
  }

  /**
   * Notify progress listeners
   */
  private notifyProgress(
    uploadId: string, 
    progress: number, 
    status: StorachaUploadProgress['status'],
    error?: string
  ) {
    const listener = this.uploadListeners.get(uploadId);
    if (listener) {
      listener({
        uploadId,
        progress,
        status,
        ...(error && { error })
      });
    }
  }

  /**
   * Generate a public IPFS gateway URL from a CID
   */
  static getPublicUrl(cid: string): string {
    return `https://${cid}.ipfs.w3s.link`;
  }

  /**
   * Extract CID from an IPFS URL
   */
  static extractCid(url: string): string | null {
    const match = url.match(/([a-zA-Z0-9]{46,})\.ipfs\./);
    return match ? match[1] : null;
  }

  /**
   * Check if a URL is an IPFS URL
   */
  static isIpfsUrl(url: string): boolean {
    return url.includes('.ipfs.') || url.startsWith('ipfs://');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const storachaService = new StorachaService();

// Export the class for static methods
export { StorachaService };

// Auto-initialize on module load
storachaService.initialize().catch(error => {
  console.warn("⚠️ Storacha auto-initialization failed:", error);
});

export default storachaService;