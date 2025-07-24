# Pinata File Storage Guide

This guide covers how to use Pinata for IPFS file storage in your Pinboard plugins, providing secure, decentralized file hosting.

## Table of Contents

1. [Overview](#overview)
2. [Setup and Configuration](#setup-and-configuration)
3. [Basic Usage](#basic-usage)
4. [Advanced Features](#advanced-features)
5. [Integration Patterns](#integration-patterns)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

The [`PinataService`](../services/pinataService.ts:28) provides a unified interface for uploading files to IPFS via Pinata, offering:

- **Decentralized Storage**: Files are stored on IPFS for permanent availability
- **Content Addressing**: Files are referenced by their content hash (CID)
- **Gateway Access**: Files accessible via HTTP through Pinata gateways
- **Progress Tracking**: Real-time upload progress monitoring
- **Error Handling**: Robust error handling and retry mechanisms

### Service Architecture

```typescript
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
```

## Setup and Configuration

### Environment Variables

Configure your Pinata credentials in your `.env` file:

```bash
# Required - Your Pinata JWT token (recommended)
VITE_PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Alternative authentication (legacy)
VITE_PINATA_KEY=your_pinata_api_key
VITE_PINATA_SECRET=your_pinata_secret_key

# Optional - Custom gateway (defaults to Pinata's public gateway)
VITE_PINATA_GATEWAY=chocolate-nearby-ladybug-431.mypinata.cloud
```

### Service Initialization

The service auto-initializes on module load, but you can manually initialize with custom config:

```typescript
import { pinataService } from "../../services/pinataService";

// Manual initialization with custom config
await pinataService.initialize({
  pinataJwt: "your_custom_jwt",
  pinataGateway: "your_custom_gateway.mypinata.cloud"
});

// Check if service is ready
if (pinataService.isReady()) {
  console.log("Pinata service is ready for uploads");
}

// Get service status
const status = pinataService.getStatus();
console.log("Service status:", status);
```

## Basic Usage

### Single File Upload

```typescript
import { pinataService } from "../../services/pinataService";

async function uploadSingleFile(file: File) {
  try {
    const result = await pinataService.uploadFile(file, (progress) => {
      console.log(`Upload progress: ${progress.progress}%`);
      console.log(`Status: ${progress.status}`);
    });

    console.log("Upload completed:", result);
    return result;
    // Returns: { cid, url, size, filename }
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
}
```

### Multiple File Upload

```typescript
async function uploadMultipleFiles(files: File[]) {
  try {
    const results = await pinataService.uploadFiles(
      files,
      (uploadId, progress) => {
        console.log(`Upload ${uploadId}: ${progress.progress}%`);
      }
    );

    console.log("All uploads completed:", results);
    return results;
  } catch (error) {
    console.error("Batch upload failed:", error);
    throw error;
  }
}
```

### Directory Upload

```typescript
async function uploadDirectory(files: File[]) {
  try {
    const result = await pinataService.uploadDirectory(
      files,
      (progress) => {
        console.log(`Directory upload: ${progress.progress}%`);
      }
    );

    console.log("Directory uploaded:", result);
    return result;
  } catch (error) {
    console.error("Directory upload failed:", error);
    throw error;
  }
}
```

## Advanced Features

### File Retrieval

```typescript
// Retrieve file data by CID
async function getFile(cid: string) {
  try {
    const data = await pinataService.getFile(cid);
    return data;
  } catch (error) {
    console.error("Failed to retrieve file:", error);
    throw error;
  }
}

// Get gateway URL for a CID
async function getGatewayUrl(cid: string) {
  try {
    const url = await pinataService.getGatewayUrl(cid);
    return url;
  } catch (error) {
    // Fallback to public gateway
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
}
```

### Static Utility Methods

```typescript
// Generate public IPFS URL
const publicUrl = PinataService.getPublicUrl(
  "QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
  "https://custom-gateway.com"
);

// Extract CID from IPFS URL
const cid = PinataService.extractCid("https://gateway.pinata.cloud/ipfs/QmXxX...");

// Check if URL is an IPFS URL
const isIpfs = PinataService.isIpfsUrl("https://gateway.pinata.cloud/ipfs/QmXxX...");
```

## Integration Patterns

### Image Plugin Integration

Here's how the [`ImageFactory`](image/factory.ts:55) uses Pinata for image uploads:

```typescript
async create(data: any, position: Position): Promise<CreateWidgetInput> {
  let src = "";
  let isFileUpload = false;

  if (data instanceof File) {
    isFileUpload = true;
    
    // Create immediate preview with blob URL
    src = URL.createObjectURL(data);
    
    try {
      // Upload to Pinata asynchronously
      const uploadResult = await pinataService.uploadFile(data, (progress) => {
        // Update progress in UI if needed
        console.log(`Image upload: ${progress.progress}%`);
      });
      
      // Clean up temporary URL
      URL.revokeObjectURL(src);
      
      // Use IPFS URL
      src = uploadResult.url;
    } catch (error) {
      console.error("Pinata upload failed, using local URL:", error);
      // Keep using blob URL as fallback
    }
  }

  const content: ImageContent = {
    src,
    alt: data.name || "Image",
    originalDimensions: { width: 400, height: 300 },
    ...(isFileUpload && { 
      isFileUpload: true, 
      originalFile: data,
      uploadStatus: 'completed' // Track upload status
    }),
  };

  return {
    type: this.type,
    x: position.x,
    y: position.y,
    width: 400,
    height: 300,
    content,
  };
}
```

### Document Plugin Integration

```typescript
// Document upload with progress tracking
async function uploadDocument(file: File, onProgress?: (progress: number) => void) {
  try {
    const result = await pinataService.uploadFile(file, (progressData) => {
      onProgress?.(progressData.progress);
    });

    // Create document widget data
    const documentContent: DocumentContent = {
      fileName: result.filename,
      fileType: file.type,
      fileSize: result.size,
      mimeType: file.type,
      downloadUrl: result.url,
      previewUrl: result.url, // Same URL for direct access
    };

    return documentContent;
  } catch (error) {
    console.error("Document upload failed:", error);
    throw new Error(`Failed to upload document: ${error.message}`);
  }
}
```

### Background Upload with Status Tracking

```typescript
interface UploadState {
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: PinataUploadResult;
}

class BackgroundUploader {
  private uploads = new Map<string, UploadState>();

  async startUpload(file: File, uploadId: string): Promise<void> {
    this.uploads.set(uploadId, { status: 'uploading', progress: 0 });

    try {
      const result = await pinataService.uploadFile(file, (progress) => {
        this.uploads.set(uploadId, {
          status: 'uploading',
          progress: progress.progress,
        });
      });

      this.uploads.set(uploadId, {
        status: 'completed',
        progress: 100,
        result,
      });
    } catch (error) {
      this.uploads.set(uploadId, {
        status: 'failed',
        progress: 0,
        error: error.message,
      });
    }
  }

  getUploadStatus(uploadId: string): UploadState | undefined {
    return this.uploads.get(uploadId);
  }

  clearUpload(uploadId: string): void {
    this.uploads.delete(uploadId);
  }
}
```

### React Hook for File Uploads

```typescript
import { useState, useCallback } from 'react';
import { pinataService } from '../../services/pinataService';

interface UseFileUploadResult {
  upload: (file: File) => Promise<PinataUploadResult>;
  uploading: boolean;
  progress: number;
  error: string | null;
  result: PinataUploadResult | null;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadResult {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PinataUploadResult | null>(null);

  const upload = useCallback(async (file: File): Promise<PinataUploadResult> => {
    setUploading(true);
    setError(null);
    setProgress(0);
    setResult(null);

    try {
      const uploadResult = await pinataService.uploadFile(file, (progressData) => {
        setProgress(progressData.progress);
      });

      setResult(uploadResult);
      return uploadResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return { upload, uploading, progress, error, result, reset };
}

// Usage in a component
function FileUploadComponent() {
  const { upload, uploading, progress, error, result, reset } = useFileUpload();

  const handleFileSelect = async (file: File) => {
    try {
      const result = await upload(file);
      console.log('File uploaded:', result.url);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      {uploading && <div>Uploading: {progress}%</div>}
      {error && <div>Error: {error}</div>}
      {result && <div>Uploaded: {result.filename}</div>}
    </div>
  );
}
```

## Best Practices

### 1. Error Handling and Fallbacks

Always implement fallback strategies for upload failures:

```typescript
async function uploadWithFallback(file: File): Promise<string> {
  try {
    // Try Pinata upload first
    const result = await pinataService.uploadFile(file);
    return result.url;
  } catch (error) {
    console.warn('Pinata upload failed, using blob URL fallback:', error);
    
    // Fallback to blob URL for immediate use
    return URL.createObjectURL(file);
  }
}
```

### 2. Progressive Enhancement

Start with immediate functionality, enhance with IPFS storage:

```typescript
async function createImageWidget(file: File, position: Position) {
  // 1. Create widget immediately with blob URL
  const tempUrl = URL.createObjectURL(file);
  const widget = await createWidget({
    src: tempUrl,
    uploadStatus: 'pending'
  }, position);

  // 2. Upgrade to IPFS URL in background
  try {
    const result = await pinataService.uploadFile(file);
    
    // Update widget with permanent URL
    updateWidget(widget.id, {
      src: result.url,
      uploadStatus: 'completed',
      ipfsCid: result.cid
    });
    
    // Clean up temporary URL
    URL.revokeObjectURL(tempUrl);
  } catch (error) {
    // Mark upload as failed but keep functional widget
    updateWidget(widget.id, {
      uploadStatus: 'failed',
      uploadError: error.message
    });
  }

  return widget;
}
```

### 3. Content Deduplication

Leverage IPFS content addressing for deduplication:

```typescript
// Cache CIDs to avoid duplicate uploads
const uploadCache = new Map<string, Promise<PinataUploadResult>>();

async function uploadWithDeduplication(file: File): Promise<PinataUploadResult> {
  // Generate a content hash for the file (simplified example)
  const fileHash = await generateFileHash(file);
  
  // Check if we're already uploading this file
  if (uploadCache.has(fileHash)) {
    return uploadCache.get(fileHash)!;
  }

  // Start upload and cache the promise
  const uploadPromise = pinataService.uploadFile(file);
  uploadCache.set(fileHash, uploadPromise);

  try {
    const result = await uploadPromise;
    return result;
  } catch (error) {
    // Remove failed upload from cache
    uploadCache.delete(fileHash);
    throw error;
  }
}

async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 4. Upload Queue Management

Implement upload queuing for better user experience:

```typescript
class UploadQueue {
  private queue: Array<{ file: File; resolve: Function; reject: Function }> = [];
  private processing = false;
  private maxConcurrent = 3;
  private active = 0;

  async add(file: File): Promise<PinataUploadResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ file, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.active >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    
    while (this.queue.length > 0 && this.active < this.maxConcurrent) {
      const item = this.queue.shift()!;
      this.active++;
      
      this.uploadFile(item.file)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.active--;
          this.processQueue(); // Process next items
        });
    }
    
    this.processing = false;
  }

  private async uploadFile(file: File): Promise<PinataUploadResult> {
    return pinataService.uploadFile(file);
  }
}

// Global upload queue instance
export const uploadQueue = new UploadQueue();
```

### 5. File Type Validation

Validate files before uploading:

```typescript
interface FileValidationRule {
  maxSize: number; // bytes
  allowedTypes: string[];
  allowedExtensions: string[];
}

const defaultValidationRules: FileValidationRule = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/*', 'video/*', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.pdf'],
};

function validateFile(file: File, rules: FileValidationRule = defaultValidationRules): void {
  // Check file size
  if (file.size > rules.maxSize) {
    throw new Error(`File too large. Maximum size: ${rules.maxSize / 1024 / 1024}MB`);
  }

  // Check file type
  const typeAllowed = rules.allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -2));
    }
    return file.type === type;
  });

  if (!typeAllowed) {
    throw new Error(`File type not allowed: ${file.type}`);
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!rules.allowedExtensions.includes(extension)) {
    throw new Error(`File extension not allowed: ${extension}`);
  }
}

// Usage
async function safeUpload(file: File): Promise<PinataUploadResult> {
  validateFile(file);
  return pinataService.uploadFile(file);
}
```

## Troubleshooting

### Common Issues

#### 1. Upload Failures

```typescript
// Robust upload with retries
async function uploadWithRetry(
  file: File, 
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<PinataUploadResult> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await pinataService.uploadFile(file);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Upload attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  throw new Error(`Upload failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

#### 2. Gateway Access Issues

```typescript
// Test multiple gateways
const BACKUP_GATEWAYS = [
  'https://gateway.pinata.cloud',
  'https://ipfs.io',
  'https://cloudflare-ipfs.com',
  'https://dweb.link',
];

async function getAccessibleUrl(cid: string): Promise<string> {
  // Try Pinata service first
  try {
    return await pinataService.getGatewayUrl(cid);
  } catch (error) {
    console.warn('Pinata gateway failed, trying alternatives:', error);
  }

  // Try backup gateways
  for (const gateway of BACKUP_GATEWAYS) {
    const testUrl = `${gateway}/ipfs/${cid}`;
    
    try {
      const response = await fetch(testUrl, { method: 'HEAD' });
      if (response.ok) {
        return testUrl;
      }
    } catch (error) {
      console.warn(`Gateway ${gateway} failed:`, error);
    }
  }

  throw new Error(`No accessible gateway found for CID: ${cid}`);
}
```

#### 3. Authentication Issues

```typescript
// Validate Pinata configuration
async function validatePinataConfig(): Promise<boolean> {
  try {
    const status = pinataService.getStatus();
    
    if (!status.initialized) {
      console.error('Pinata service not initialized');
      return false;
    }

    if (!status.config.hasJwt && !status.config.hasKey) {
      console.error('No Pinata authentication configured');
      return false;
    }

    // Test with a small upload
    const testFile = new Blob(['test'], { type: 'text/plain' });
    const testResult = await pinataService.uploadFile(
      new File([testFile], 'test.txt')
    );
    
    console.log('Pinata configuration valid:', testResult.cid);
    return true;
  } catch (error) {
    console.error('Pinata configuration invalid:', error);
    return false;
  }
}
```

### Debug Logging

Enable debug logging for troubleshooting:

```typescript
// Add to your development environment
if (import.meta.env.DEV) {
  // Override console methods to track Pinata operations
  const originalLog = console.log;
  console.log = (...args) => {
    if (args[0]?.includes?.('Pinata') || args[0]?.includes?.('IPFS')) {
      originalLog('🔍 [PINATA DEBUG]', ...args);
    } else {
      originalLog(...args);
    }
  };
}
```

### Performance Monitoring

Monitor upload performance:

```typescript
class UploadMetrics {
  private metrics = new Map<string, {
    startTime: number;
    fileSize: number;
    duration?: number;
    speed?: number; // bytes per second
  }>();

  startUpload(uploadId: string, fileSize: number): void {
    this.metrics.set(uploadId, {
      startTime: Date.now(),
      fileSize,
    });
  }

  completeUpload(uploadId: string): void {
    const metric = this.metrics.get(uploadId);
    if (metric) {
      const duration = Date.now() - metric.startTime;
      const speed = metric.fileSize / (duration / 1000); // bytes per second
      
      this.metrics.set(uploadId, {
        ...metric,
        duration,
        speed,
      });

      console.log(`Upload completed: ${metric.fileSize} bytes in ${duration}ms (${(speed / 1024).toFixed(2)} KB/s)`);
    }
  }

  getAverageSpeed(): number {
    const completed = Array.from(this.metrics.values()).filter(m => m.speed);
    if (completed.length === 0) return 0;
    
    const totalSpeed = completed.reduce((sum, m) => sum + m.speed!, 0);
    return totalSpeed / completed.length;
  }
}

// Usage
const uploadMetrics = new UploadMetrics();

async function monitoredUpload(file: File): Promise<PinataUploadResult> {
  const uploadId = `upload_${Date.now()}`;
  uploadMetrics.startUpload(uploadId, file.size);

  try {
    const result = await pinataService.uploadFile(file);
    uploadMetrics.completeUpload(uploadId);
    return result;
  } catch (error) {
    uploadMetrics.completeUpload(uploadId);
    throw error;
  }
}
```

This documentation provides comprehensive guidance for using Pinata file storage in your Pinboard plugins, covering everything from basic uploads to advanced patterns and troubleshooting.