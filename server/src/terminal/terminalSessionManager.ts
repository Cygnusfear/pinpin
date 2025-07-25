/**
 * Terminal Session Manager
 *
 * Manages terminal sessions using node-pty for real shell access.
 * Each session corresponds to a terminal widget and has its own isolated shell process.
 */

import { EventEmitter } from "node:events";
import * as pty from "node-pty";

export interface TerminalSession {
  id: string;
  ptyProcess: pty.IPty;
  isActive: boolean;
  createdAt: number;
  lastActivity: number;
  widgetId: string;
}

export interface TerminalSessionOptions {
  shell?: string;
  cwd?: string;
  env?: { [key: string]: string };
  cols?: number;
  rows?: number;
}

export class TerminalSessionManager extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();

    // Clean up inactive sessions every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupInactiveSessions();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Create a new terminal session
   */
  createSession(
    sessionId: string,
    widgetId: string,
    options: TerminalSessionOptions = {},
  ): TerminalSession {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    // Default options
    const defaultShell =
      process.platform === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/bash";
    const sessionOptions = {
      shell: options.shell || defaultShell,
      cwd: options.cwd || process.env.HOME || process.cwd(),
      env: { ...process.env, ...options.env },
      cols: options.cols || 80,
      rows: options.rows || 24,
    };

    // Create PTY process
    const ptyProcess = pty.spawn(sessionOptions.shell, [], {
      name: "xterm-color",
      cols: sessionOptions.cols,
      rows: sessionOptions.rows,
      cwd: sessionOptions.cwd,
      env: sessionOptions.env,
    });

    const session: TerminalSession = {
      id: sessionId,
      ptyProcess,
      isActive: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      widgetId,
    };

    // Set up PTY event handlers
    ptyProcess.onData((data: string) => {
      session.lastActivity = Date.now();
      this.emit("data", sessionId, data);
    });

    ptyProcess.onExit((exitCode: { exitCode: number; signal?: number }) => {
      console.log(
        `Terminal session ${sessionId} exited with code:`,
        exitCode.exitCode,
      );
      this.emit("exit", sessionId, exitCode);
      this.destroySession(sessionId);
    });

    this.sessions.set(sessionId, session);

    console.log(
      `Created terminal session: ${sessionId} for widget: ${widgetId}`,
    );
    this.emit("sessionCreated", sessionId, session);

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Write data to a terminal session
   */
  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    session.lastActivity = Date.now();
    session.ptyProcess.write(data);
    return true;
  }

  /**
   * Resize a terminal session
   */
  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    session.ptyProcess.resize(cols, rows);
    session.lastActivity = Date.now();
    return true;
  }

  /**
   * Destroy a terminal session
   */
  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      if (session.isActive) {
        session.ptyProcess.kill();
      }
    } catch (error) {
      console.error(
        `Error killing PTY process for session ${sessionId}:`,
        error,
      );
    }

    session.isActive = false;
    this.sessions.delete(sessionId);

    console.log(`Destroyed terminal session: ${sessionId}`);
    this.emit("sessionDestroyed", sessionId);

    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.isActive,
    );
  }

  /**
   * Get sessions for a specific widget
   */
  getSessionsForWidget(widgetId: string): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.widgetId === widgetId && session.isActive,
    );
  }

  /**
   * Clean up inactive sessions (older than 1 hour with no activity)
   */
  private cleanupInactiveSessions(): void {
    const cutoffTime = Date.now() - 60 * 60 * 1000; // 1 hour ago
    const sessionsToDestroy: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.lastActivity < cutoffTime) {
        sessionsToDestroy.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDestroy) {
      console.log(`Cleaning up inactive session: ${sessionId}`);
      this.destroySession(sessionId);
    }
  }

  /**
   * Destroy all sessions and cleanup
   */
  shutdown(): void {
    console.log("Shutting down terminal session manager...");

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Destroy all active sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      this.destroySession(sessionId);
    }

    this.removeAllListeners();
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    oldestSession: number | null;
    newestSession: number | null;
  } {
    const activeSessions = this.getActiveSessions();
    const timestamps = activeSessions.map((s) => s.createdAt);

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      oldestSession: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestSession: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }
}

// Singleton instance
export const terminalSessionManager = new TerminalSessionManager();

// Cleanup on process exit
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down terminal session manager...");
  terminalSessionManager.shutdown();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down terminal session manager...");
  terminalSessionManager.shutdown();
  process.exit(0);
});
