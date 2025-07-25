/**
 * Terminal WebSocket Handler
 *
 * Handles WebSocket connections for terminal sessions.
 * Each connection corresponds to a terminal widget in the frontend.
 */

import type { WebSocket } from "ws";
import type { ExpressWithRouteTracking } from "../routeTracker.js";
import { terminalSessionManager } from "./terminalSessionManager.js";

export interface TerminalWebSocketMessage {
  type: "create" | "data" | "resize" | "destroy";
  sessionId: string;
  widgetId: string;
  data?: string;
  cols?: number;
  rows?: number;
  options?: {
    shell?: string;
    cwd?: string;
    env?: { [key: string]: string };
  };
}

export interface TerminalWebSocketResponse {
  type: "data" | "exit" | "error" | "created" | "destroyed";
  sessionId: string;
  data?: string;
  exitCode?: number;
  error?: string;
}

/**
 * Set up terminal WebSocket routes
 */
export function setupTerminalWebSocket(app: ExpressWithRouteTracking): void {
  // Use the native WebSocket support from ExpressWithRouteTracking
  app.ws("/api/terminal/:widgetId", (ws: WebSocket, req: any) => {
    const widgetId = req.params.widgetId;
    let sessionId: string | null = null;

    console.log(`Terminal WebSocket connected for widget: ${widgetId}`);

    // Set up session manager event listeners
    const handleSessionData = (sid: string, data: string) => {
      if (sid === sessionId) {
        console.log(
          `📤 Sending PTY data to client for session ${sid}:`,
          JSON.stringify(data),
        );
        const response: TerminalWebSocketResponse = {
          type: "data",
          sessionId: sid,
          data,
        };
        ws.send(JSON.stringify(response));
      }
    };

    const handleSessionExit = (
      sid: string,
      exitCode: { exitCode: number; signal?: number },
    ) => {
      if (sid === sessionId) {
        const response: TerminalWebSocketResponse = {
          type: "exit",
          sessionId: sid,
          exitCode: exitCode.exitCode,
        };
        ws.send(JSON.stringify(response));
        sessionId = null;
      }
    };

    const handleSessionDestroyed = (sid: string) => {
      if (sid === sessionId) {
        const response: TerminalWebSocketResponse = {
          type: "destroyed",
          sessionId: sid,
        };
        ws.send(JSON.stringify(response));
        sessionId = null;
      }
    };

    // Subscribe to session events
    terminalSessionManager.on("data", handleSessionData);
    terminalSessionManager.on("exit", handleSessionExit);
    terminalSessionManager.on("sessionDestroyed", handleSessionDestroyed);

    // Handle incoming WebSocket messages
    ws.on("message", (message: Buffer) => {
      try {
        const msg: TerminalWebSocketMessage = JSON.parse(message.toString());

        switch (msg.type) {
          case "create":
            try {
              // Generate unique session ID
              sessionId = `${widgetId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

              const session = terminalSessionManager.createSession(
                sessionId,
                widgetId,
                {
                  shell: msg.options?.shell,
                  cwd: msg.options?.cwd,
                  env: msg.options?.env,
                  cols: msg.cols || 80,
                  rows: msg.rows || 24,
                },
              );

              const response: TerminalWebSocketResponse = {
                type: "created",
                sessionId,
              };
              ws.send(JSON.stringify(response));

              console.log(
                `Created terminal session ${sessionId} for widget ${widgetId}`,
              );

              // Send a welcome message to test if the terminal can receive data
              setTimeout(() => {
                if (sessionId) {
                  const welcomeData: TerminalWebSocketResponse = {
                    type: "data",
                    sessionId,
                    data: `\r\n\x1b[32mTerminal session ${sessionId.slice(-8)} ready\x1b[0m\r\n`,
                  };
                  ws.send(JSON.stringify(welcomeData));
                  console.log(`Sent welcome message to session ${sessionId}`);

                  // Send an empty command to trigger shell prompt
                  setTimeout(() => {
                    if (sessionId) {
                      const success = terminalSessionManager.writeToSession(
                        sessionId,
                        "\r",
                      );
                      console.log(
                        `Sent newline to trigger prompt for session ${sessionId}: ${success}`,
                      );
                    }
                  }, 200);
                }
              }, 100);
            } catch (error) {
              const response: TerminalWebSocketResponse = {
                type: "error",
                sessionId: msg.sessionId,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to create session",
              };
              ws.send(JSON.stringify(response));
            }
            break;

          case "data":
            if (sessionId && msg.data) {
              const success = terminalSessionManager.writeToSession(
                sessionId,
                msg.data,
              );
              if (!success) {
                const response: TerminalWebSocketResponse = {
                  type: "error",
                  sessionId,
                  error: "Failed to write to session",
                };
                ws.send(JSON.stringify(response));
              }
            }
            break;

          case "resize":
            if (sessionId && msg.cols && msg.rows) {
              const success = terminalSessionManager.resizeSession(
                sessionId,
                msg.cols,
                msg.rows,
              );
              if (!success) {
                const response: TerminalWebSocketResponse = {
                  type: "error",
                  sessionId,
                  error: "Failed to resize session",
                };
                ws.send(JSON.stringify(response));
              }
            }
            break;

          case "destroy":
            if (sessionId) {
              terminalSessionManager.destroySession(sessionId);
              sessionId = null;
            }
            break;

          default:
            console.warn(`Unknown message type: ${(msg as any).type}`);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
        const response: TerminalWebSocketResponse = {
          type: "error",
          sessionId: sessionId || "unknown",
          error: "Invalid message format",
        };
        ws.send(JSON.stringify(response));
      }
    });

    // Handle WebSocket close
    ws.on("close", () => {
      console.log(`Terminal WebSocket disconnected for widget: ${widgetId}`);

      // Clean up session if it exists
      if (sessionId) {
        terminalSessionManager.destroySession(sessionId);
      }

      // Remove event listeners
      terminalSessionManager.off("data", handleSessionData);
      terminalSessionManager.off("exit", handleSessionExit);
      terminalSessionManager.off("sessionDestroyed", handleSessionDestroyed);
    });

    // Handle WebSocket errors
    ws.on("error", (error) => {
      console.error(`Terminal WebSocket error for widget ${widgetId}:`, error);

      // Clean up session if it exists
      if (sessionId) {
        terminalSessionManager.destroySession(sessionId);
      }
    });

    // Send initial connection confirmation
    const welcomeResponse: TerminalWebSocketResponse = {
      type: "data",
      sessionId: "system",
      data: `\r\n\x1b[32mTerminal WebSocket connected for widget ${widgetId}\x1b[0m\r\n`,
    };
    ws.send(JSON.stringify(welcomeResponse));
  });

  // Health endpoint for terminal service
  app.get("/api/terminal/health", (_req: any, res: any) => {
    const stats = terminalSessionManager.getStats();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      sessions: stats,
    });
  });

  console.log("Terminal WebSocket routes configured");
}
