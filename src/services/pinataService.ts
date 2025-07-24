import { PinataSDK } from "pinata";
import ENV from "./env";
// import { logger } from "./logger";

// ============================================================================
// PINATA SERVICE - IPFS FILE STORAGE VIA PINATA SDK
// ============================================================================

export interface PinataUploadResult {
  cid: string; // Content Identifier (IPFS hash)
  url: string; // IPFS gateway URL
  size: number;
  filename: string;
}

export interface PinataUploadProgress {
  uploadId: string;
  progress: number; // 0-100
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface PinataConfig {
  pinataJwt?: string;
  pinataGateway?: string;
}

export class PinataService {
  private pinata: PinataSDK | null = null;
  private config: PinataConfig = {};
  private uploadListeners: Map<string, (progress: PinataUploadProgress) => void> = new Map();

  /**
   * Initialize the Pinata SDK
   */
  async initialize(config: PinataConfig = {}) {
    try {
      // Store config for later use
      this.config = {
        pinataJwt: config.pinataJwt || ENV.VITE_PINATA_JWT,
        pinataGateway: config.pinataGateway || ENV.VITE_PINATA_GATEWAY,
        ...config
      };

      if (!this.config.pinataJwt) {
        console.warn("⚠️ Pinata JWT not configured. File uploads will not work.");
        return false;
      }

      // Initialize the Pinata SDK
      this.pinata = new PinataSDK({
        pinataJwt: this.config.pinataJwt,
        pinataGateway: this.config.pinataGateway
      });

      console.log("✅ Pinata SDK initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize Pinata SDK:", error);
      return false;
    }
  }

  /**
   * Upload a single file to Pinata
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: PinataUploadProgress) => void
  ): Promise<PinataUploadResult> {
    if (!this.pinata) {
      throw new Error("Pinata SDK not initialized. Call initialize() first.");
    }

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Register progress listener if provided
      if (onProgress) {
        this.uploadListeners.set(uploadId, onProgress);
      }

      // Notify upload start
      this.notifyProgress(uploadId, 0, 'uploading');

      // Upload to Pinata using the SDK
      const upload = await this.pinata.upload.public.file(file);
      // logger.pinata_service.info('File uploaded to Pinata', {
      //   cid: upload.cid,
      //   filename: file.name,
      //   size: file.size,
      //   service: 'PinataService'
      // });
      // Notify upload completion
      this.notifyProgress(uploadId, 100, 'completed');

      // Construct gateway URL using the SDK's convert method
      const url = await this.pinata.gateways.public.convert(upload.cid);

      const uploadResult: PinataUploadResult = {
        cid: upload.cid,
        url,
        size: file.size,
        filename: file.name
      };

      console.log("✅ File uploaded to Pinata:", uploadResult);
      return uploadResult;

    } catch (error) {
      console.error("❌ Pinata upload failed:", error);
      // logger.pinata_service.error('File upload failed', {
      //   error: error.message,
      //   filename: file.name,
      //   service: 'PinataService'
      // });
      this.notifyProgress(uploadId, 0, 'failed', error.message);
      throw error;
    } finally {
      // Clean up listener
      this.uploadListeners.delete(uploadId);
    }
  }

  /**
   * Upload multiple files to Pinata
   */
  async uploadFiles(
    files: File[],
    onProgress?: (uploadId: string, progress: PinataUploadProgress) => void
  ): Promise<PinataUploadResult[]> {
    const results: PinataUploadResult[] = [];
    
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
   * Upload a directory of files to Pinata as a folder
   * Note: This is a simplified implementation that uploads the first file.
   * For proper directory uploads, check the latest Pinata SDK documentation.
   */
  async uploadDirectory(
    files: File[],
    onProgress?: (progress: PinataUploadProgress) => void
  ): Promise<PinataUploadResult> {
    if (!this.pinata) {
      throw new Error("Pinata SDK not initialized. Call initialize() first.");
    }

    const uploadId = `dir_upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Register progress listener if provided
      if (onProgress) {
        this.uploadListeners.set(uploadId, onProgress);
      }

      // Notify upload start
      this.notifyProgress(uploadId, 0, 'uploading');

      // For now, upload the first file as a representative
      // TODO: Check Pinata SDK docs for proper directory upload method
      const firstFile = files[0];
      const upload = await this.pinata.upload.public.file(firstFile);
      
      // Notify upload completion
      this.notifyProgress(uploadId, 100, 'completed');

      // Calculate total size
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // Construct gateway URL
      const url = await this.pinata.gateways.public.convert(upload.cid);

      const uploadResult: PinataUploadResult = {
        cid: upload.cid,
        url,
        size: totalSize,
        filename: `directory_${files.length}_files`
      };

      console.log("✅ Directory uploaded to Pinata:", uploadResult);
      return uploadResult;

    } catch (error) {
      console.error("❌ Pinata directory upload failed:", error);
      this.notifyProgress(uploadId, 0, 'failed', error.message);
      throw error;
    } finally {
      // Clean up listener
      this.uploadListeners.delete(uploadId);
    }
  }

  /**
   * Retrieve a file from Pinata by CID
   */
  async getFile(cid: string): Promise<any> {
    if (!this.pinata) {
      throw new Error("Pinata SDK not initialized. Call initialize() first.");
    }

    try {
      const data = await this.pinata.gateways.public.get(cid);
      // logger.pinata_service.info('File retrieved from Pinata', {
      //   cid,
      //   service: 'PinataService'
      // });
      return data;
    } catch (error) {
      console.error("❌ Pinata get file failed:", error);
      // logger.pinata_service.error('File retrieval failed', {
      //   error: error.message,
      //   cid,
      //   service: 'PinataService'
      // });
      throw error;
    }
  }

  /**
   * Get gateway URL for a CID
   */
  async getGatewayUrl(cid: string): Promise<string> {
    if (!this.pinata) {
      throw new Error("Pinata SDK not initialized. Call initialize() first.");
    }

    try {
      return await this.pinata.gateways.public.convert(cid);
    } catch (error) {
      console.error("❌ Pinata gateway URL conversion failed:", error);
      // Fallback to manual URL construction
      const gateway = this.config.pinataGateway || 'https://gateway.pinata.cloud';
      return `${gateway}/ipfs/${cid}`;
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.pinata !== null;
  }

  /**
   * Get service status and configuration info
   */
  getStatus() {
    return {
      initialized: this.isReady(),
      config: {
        hasJwt: !!this.config.pinataJwt,
        hasGateway: !!this.config.pinataGateway
      }
    };
  }

  /**
   * Notify progress listeners
   */
  private notifyProgress(
    uploadId: string, 
    progress: number, 
    status: PinataUploadProgress['status'],
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
  static getPublicUrl(cid: string, gatewayUrl?: string): string {
    const gateway = gatewayUrl || 'https://gateway.pinata.cloud';
    return `${gateway}/ipfs/${cid}`;
  }

  /**
   * Extract CID from an IPFS URL
   */
  static extractCid(url: string): string | null {
    // Handle various IPFS URL formats
    const patterns = [
      /\/ipfs\/([a-zA-Z0-9]{46,})/,  // /ipfs/QmXXX or /ipfs/bafXXX
      /ipfs:\/\/([a-zA-Z0-9]{46,})/,  // ipfs://QmXXX or ipfs://bafXXX
      /([a-zA-Z0-9]{46,})\.ipfs\./    // QmXXX.ipfs.gateway.com
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }

  /**
   * Check if a URL is an IPFS URL
   */
  static isIpfsUrl(url: string): boolean {
    return url.includes('/ipfs/') || url.includes('.ipfs.') || url.startsWith('ipfs://');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const pinataService = new PinataService();

// Auto-initialize on module load
pinataService.initialize().catch(error => {
  console.warn("⚠️ Pinata auto-initialization failed:", error);
});

export default pinataService;