import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Removed keepsync imports - using WebSocket bridge instead
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { FileSystemRoutes } from "./fileSystemRoutes.js";
import { ExpressWithRouteTracking } from "./routeTracker.js";

// Import configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..");

// Load environment variables from .env file in project root
dotenv.config({ path: join(projectRoot, ".env") });

// NOTE: if you do not use ExpressWithRouteTracking, the endpoints will break. This is very important.
// You MUST use ExpressWithRouteTracking!
const app = new ExpressWithRouteTracking();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 6080;

// Enable CORS
app.use(cors());

// Enable JSON parsing for POST requests
app.use(express.json());

// Initialize file system routes
new FileSystemRoutes(app, projectRoot);

// Import and setup chat routes
import {
  claudeChatHandler,
  claudeLocationHandler,
  healthHandler,
} from "./routes/chatHandlers.js";
import { terminalSessionManager } from "./terminal/terminalSessionManager.js";
// Import terminal WebSocket setup
import { setupTerminalWebSocket } from "./terminal/terminalWebSocketHandler.js";

// Claude AI chat endpoints
app.post("/api/claude/chat", claudeChatHandler);
app.post("/api/claude/generate-starting-location", claudeLocationHandler);
app.get("/api/health", healthHandler);

// Terminal test endpoint for debugging
app.post("/api/terminal/test", (req: any, res: any) => {
  const { sessionId, data } = req.body;
  if (!sessionId || !data) {
    return res.status(400).json({ error: "sessionId and data required" });
  }

  const success = terminalSessionManager.writeToSession(sessionId, data);
  res.json({ success, sessionId, data });
});

// List all active sessions for debugging
app.get("/api/terminal/sessions", (_req: any, res: any) => {
  const sessions = terminalSessionManager.getActiveSessions();
  const sessionInfo = sessions.map((s) => ({
    id: s.id,
    widgetId: s.widgetId,
    createdAt: new Date(s.createdAt).toISOString(),
    lastActivity: new Date(s.lastActivity).toISOString(),
  }));
  res.json({ sessions: sessionInfo });
});

// Set up terminal WebSocket routes
setupTerminalWebSocket(app);

// WebSocket bridge removed - MCP server now connects directly to keepsync

// Keepsync API endpoints removed - MCP server now connects directly to keepsync

// Add ping endpoint for health checks
// WARNING: ALL SERVERS MUST INCLUDE A /ping ENDPOINT FOR HEALTH CHECKS, OTHERWISE THEY WILL FAIL
app.get("/ping", (_req, res) => {
  res.status(200).send("OK");
});

// Check if --routes CLI parameter is provided
const hasRoutesParam = process.argv.includes("--routes");

// Start the server only if --routes parameter is not provided
if (!hasRoutesParam) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} else {
  // Output routes in JSON format for nginx generation using tracked routes
  const trackedRoutes = app.getRoutes();
  const routes = trackedRoutes.map((route) => ({
    path: route.path,
    methods:
      route.method === "ALL"
        ? ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
        : [route.method],
    ...(route.params && { params: route.params }),
  }));

  // Write routes to file for nginx generation
  const routesFilePath = join(__dirname, "..", "server-routes.json");
  fs.writeFileSync(routesFilePath, JSON.stringify(routes, null, 2));
  console.log(`Routes written to ${routesFilePath}`);
}
