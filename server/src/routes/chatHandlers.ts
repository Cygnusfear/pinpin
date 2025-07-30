/**
 * Health Check Handler
 *
 * Basic health check endpoint for the pinboard system.
 */

import type { Request, Response } from "express";

/**
 * Health check endpoint handler
 */
export const healthHandler = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "pinboard-chat",
  });
};