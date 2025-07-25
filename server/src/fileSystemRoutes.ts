import { Request, Response } from "express";
import { promises as fsPromises } from "fs";
import { join, resolve, relative, isAbsolute, dirname } from "path";
import { ExpressWithRouteTracking } from "./routeTracker.js";

// TypeScript interfaces for API requests/responses
interface ListDirectoryRequest {
  path: string;
}

interface ListDirectoryResponse {
  items: Array<{
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified: string;
  }>;
  currentPath: string;
}

interface ReadFileRequest {
  path: string;
  encoding?: string;
}

interface ReadFileResponse {
  content: string;
  size: number;
  modified: string;
  encoding: string;
}

interface WriteFileRequest {
  path: string;
  content: string;
  encoding?: string;
}

interface WriteFileResponse {
  success: boolean;
  path: string;
  size: number;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

/**
 * File System Proxy API
 * 
 * Provides secure access to file system operations through HTTP endpoints.
 * All paths are resolved relative to the project root for security.
 */
export class FileSystemRoutes {
  private app: ExpressWithRouteTracking;
  private projectRoot: string;

  constructor(app: ExpressWithRouteTracking, projectRoot: string) {
    this.app = app;
    this.projectRoot = projectRoot;
    this.setupRoutes();
  }

  /**
   * Validates and resolves a path relative to project root
   * Prevents directory traversal attacks
   */
  private validateAndResolvePath(requestPath: string): string {
    if (!requestPath || typeof requestPath !== 'string') {
      throw new Error('Path is required and must be a string');
    }

    // Remove any leading/trailing whitespace
    const cleanPath = requestPath.trim();
    
    // Resolve the path relative to project root
    const resolvedPath = isAbsolute(cleanPath) 
      ? cleanPath 
      : resolve(this.projectRoot, cleanPath);

    // Ensure the resolved path is within project root (prevent directory traversal)
    const relativePath = relative(this.projectRoot, resolvedPath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error('Access denied: Path is outside project root');
    }

    return resolvedPath;
  }

  /**
   * Setup all file system API routes
   */
  private setupRoutes(): void {
    this.setupListRoute();
    this.setupReadRoute();
    this.setupWriteRoute();
  }

  /**
   * List directory contents
   * GET /api/fs/list?path=/some/path
   */
  private setupListRoute(): void {
    this.app.get('/api/fs/list', async (req: Request, res: Response) => {
      try {
        const { path: requestPath = '.' } = req.query as Partial<ListDirectoryRequest>;
        
        const resolvedPath = this.validateAndResolvePath(requestPath);

        // Check if path exists and is a directory
        let stats;
        try {
          stats = await fsPromises.stat(resolvedPath);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            res.status(404).json({ 
              error: 'Directory not found' 
            } as ErrorResponse);
            return;
          }
          throw error;
        }

        if (!stats.isDirectory()) {
          res.status(400).json({ 
            error: 'Path is not a directory' 
          } as ErrorResponse);
          return;
        }

        // Read directory contents
        const items = await fsPromises.readdir(resolvedPath);
        
        const directoryItems = await Promise.all(
          items.map(async (item) => {
            try {
              const itemPath = join(resolvedPath, item);
              const itemStats = await fsPromises.stat(itemPath);
              
              return {
                name: item,
                type: itemStats.isDirectory() ? 'directory' as const : 'file' as const,
                size: itemStats.isFile() ? itemStats.size : undefined,
                modified: itemStats.mtime.toISOString()
              };
            } catch (error) {
              // If we can't stat an item, skip it
              return null;
            }
          })
        );

        // Filter out null items (files we couldn't stat)
        const validItems = directoryItems.filter(item => item !== null);

        const response: ListDirectoryResponse = {
          items: validItems,
          currentPath: relative(this.projectRoot, resolvedPath) || '.'
        };

        res.json(response);

      } catch (error) {
        console.error('List directory error:', error);
        
        if (error instanceof Error) {
          if (error.message.includes('Access denied')) {
            res.status(403).json({ 
              error: error.message 
            } as ErrorResponse);
            return;
          }
          
          if (error.message.includes('Path is required')) {
            res.status(400).json({ 
              error: error.message 
            } as ErrorResponse);
            return;
          }
        }

        res.status(500).json({ 
          error: 'Failed to list directory contents' 
        } as ErrorResponse);
      }
    });
  }

  /**
   * Read file contents
   * GET /api/fs/read?path=/some/file.txt&encoding=utf8
   */
  private setupReadRoute(): void {
    this.app.get('/api/fs/read', async (req: Request, res: Response) => {
      try {
        const { path: requestPath, encoding = 'utf8' } = req.query as Partial<ReadFileRequest>;
        
        if (!requestPath) {
          res.status(400).json({ 
            error: 'Path parameter is required' 
          } as ErrorResponse);
          return;
        }

        const resolvedPath = this.validateAndResolvePath(requestPath);

        // Check if path exists and is a file
        let stats;
        try {
          stats = await fsPromises.stat(resolvedPath);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            res.status(404).json({ 
              error: 'File not found' 
            } as ErrorResponse);
            return;
          }
          throw error;
        }

        if (!stats.isFile()) {
          res.status(400).json({ 
            error: 'Path is not a file' 
          } as ErrorResponse);
          return;
        }

        // Validate encoding
        const validEncodings = ['utf8', 'ascii', 'base64', 'hex'];
        if (!validEncodings.includes(encoding)) {
          res.status(400).json({ 
            error: `Invalid encoding. Supported encodings: ${validEncodings.join(', ')}` 
          } as ErrorResponse);
          return;
        }

        // Read file content
        const content = await fsPromises.readFile(resolvedPath, encoding as BufferEncoding);

        const response: ReadFileResponse = {
          content,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          encoding
        };

        res.json(response);

      } catch (error) {
        console.error('Read file error:', error);
        
        if (error instanceof Error) {
          if (error.message.includes('Access denied')) {
            res.status(403).json({ 
              error: error.message 
            } as ErrorResponse);
            return;
          }
          
          if (error.message.includes('EISDIR')) {
            res.status(400).json({ 
              error: 'Path is a directory, not a file' 
            } as ErrorResponse);
            return;
          }
        }

        res.status(500).json({ 
          error: 'Failed to read file' 
        } as ErrorResponse);
      }
    });
  }

  /**
   * Write file contents
   * POST /api/fs/write
   * Body: { path: "/some/file.txt", content: "file content", encoding?: "utf8" }
   */
  private setupWriteRoute(): void {
    this.app.post('/api/fs/write', async (req: Request, res: Response) => {
      try {
        const { path: requestPath, content, encoding = 'utf8' } = req.body as WriteFileRequest;
        
        // Validate required fields
        if (!requestPath || typeof requestPath !== 'string') {
          return res.status(400).json({ 
            error: 'Path is required and must be a string' 
          } as ErrorResponse);
        }

        if (content === undefined || content === null) {
          return res.status(400).json({ 
            error: 'Content is required' 
          } as ErrorResponse);
        }

        if (typeof content !== 'string') {
          return res.status(400).json({ 
            error: 'Content must be a string' 
          } as ErrorResponse);
        }

        const resolvedPath = this.validateAndResolvePath(requestPath);

        // Validate encoding
        const validEncodings = ['utf8', 'ascii', 'base64', 'hex'];
        if (!validEncodings.includes(encoding)) {
          return res.status(400).json({ 
            error: `Invalid encoding. Supported encodings: ${validEncodings.join(', ')}`
          } as ErrorResponse);
        }

        // Ensure directory exists
        const fileDir = dirname(resolvedPath);
        await fsPromises.mkdir(fileDir, { recursive: true });

        // Write file content
        await fsPromises.writeFile(resolvedPath, content, encoding as BufferEncoding);

        // Get file stats after writing
        const stats = await fsPromises.stat(resolvedPath);

        const response: WriteFileResponse = {
          success: true,
          path: relative(this.projectRoot, resolvedPath),
          size: stats.size
        };

        res.status(201).json(response);

      } catch (error) {
        console.error('Write file error:', error);
        
        if (error instanceof Error) {
          if (error.message.includes('Access denied')) {
            return res.status(403).json({ 
              error: error.message 
            } as ErrorResponse);
          }
          
          if (error.message.includes('EACCES')) {
            return res.status(403).json({ 
              error: 'Permission denied' 
            } as ErrorResponse);
          }
          
          if (error.message.includes('ENOSPC')) {
            return res.status(507).json({ 
              error: 'Insufficient storage space' 
            } as ErrorResponse);
          }
        }

        res.status(500).json({ 
          error: 'Failed to write file' 
        } as ErrorResponse);
      }
    });
  }
}