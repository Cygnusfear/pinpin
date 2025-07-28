/**
 * Terminal Widget Renderer
 *
 * React component for rendering terminal widgets using xterm.js
 * Session state is kept local to avoid CRDT synchronization conflicts
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import {
  useWidget,
  useWidgetActions,
  useWidgetContent,
  useWidgetContentError,
  useWidgetState,
} from "../../stores/selectiveHooks";
import type { WidgetRendererProps } from "../../types/widgets";
import type {
  TerminalConnectionState,
  TerminalContent,
  TerminalMessage,
  TerminalResponse,
  TerminalSessionState,
} from "./types";

// Import xterm CSS
import "xterm/css/xterm.css";

/**
 * Terminal Widget Renderer
 * Session state is kept local to avoid CRDT synchronization conflicts
 */
export const TerminalRenderer: React.FC<WidgetRendererProps> = React.memo(
  ({ widgetId }) => {
    // Selective subscriptions - only re-render when specific data changes
    const contentData = useWidgetContent(widgetId, (content) => content?.data);
    const widget = useWidget(widgetId);
    const transformScale = useWidgetState(
      widgetId,
      (state) => state.transform.scale,
    );
    const { updateContent } = useWidgetActions(widgetId);

    // Get widget properties
    const isContentLoaded = !!contentData;
    const contentError = useWidgetContentError(widgetId);
    const contentId = widget?.contentId;

    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isInitializedRef = useRef(false);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Stable references that NEVER cause re-renders
    const widgetIdRef = useRef(widgetId);
    const contentIdRef = useRef(contentId);
    const updateContentRef = useRef(updateContent);
    const currentDataRef = useRef(contentData);

    // Update refs without causing re-renders
    useEffect(() => {
      widgetIdRef.current = widgetId;
      contentIdRef.current = contentId;
      updateContentRef.current = updateContent;
      currentDataRef.current = contentData;
    });

    // LOCAL session state - NOT synchronized via CRDT
    const [sessionState, setSessionState] = useState<TerminalSessionState>({
      sessionId: null,
      isConnected: false,
      lastActivity: Date.now(),
    });

    const [connectionState, setConnectionState] =
      useState<TerminalConnectionState>({
        isConnecting: false,
        isConnected: false,
        error: null,
        retryCount: 0,
        lastConnected: null,
      });

    // Use ref to track connection state to avoid dependency loops
    const connectionStateRef = useRef(connectionState);
    connectionStateRef.current = connectionState;

    // Handle WebSocket messages - NO content store updates for session state
    const handleWebSocketMessage = useCallback((response: TerminalResponse) => {
      switch (response.type) {
        case "created":
          setSessionState((prev) => ({
            ...prev,
            sessionId: response.sessionId,
            isConnected: true,
            lastActivity: Date.now(),
          }));
          break;

        case "data":
          if (xtermRef.current && response.data) {
            xtermRef.current.write(response.data);
            // Update last activity timestamp locally only
            setSessionState((prev) => ({
              ...prev,
              lastActivity: Date.now(),
            }));
          }
          break;

        case "exit":
          console.log("Terminal session exited with code:", response.exitCode);
          if (xtermRef.current) {
            xtermRef.current.write(
              `\r\n\x1b[31mSession exited with code ${response.exitCode}\x1b[0m\r\n`,
            );
          }
          setSessionState((prev) => ({
            ...prev,
            sessionId: null,
            isConnected: false,
          }));
          break;

        case "error":
          console.error("Terminal error:", response.error);
          if (xtermRef.current) {
            xtermRef.current.write(
              `\r\n\x1b[31mError: ${response.error}\x1b[0m\r\n`,
            );
          }
          setConnectionState((prev) => ({
            ...prev,
            error: response.error || "Unknown error",
          }));
          break;

        case "destroyed":
          console.log("Terminal session destroyed");
          setSessionState((prev) => ({
            ...prev,
            sessionId: null,
            isConnected: false,
          }));
          break;
      }
    }, []);

    // Initialize terminal - STABLE, no widget data dependencies
    const initializeTerminal = useCallback((): Terminal | null => {
      if (!terminalRef.current || xtermRef.current) return null;

      const container = terminalRef.current;
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        return null;
      }

      const data = currentDataRef.current;

      try {
        const terminal = new Terminal({
          allowProposedApi: true,
          theme: {
            background: data.theme?.background || "#1a1a1a",
            foreground: data.theme?.foreground || "#ffffff",
            cursor: data.theme?.cursor || "#ffffff",
            selectionBackground: data.theme?.selection || "#404040",
          },
          fontSize: data.settings?.fontSize || 14,
          fontFamily:
            data.settings?.fontFamily ||
            "Monaco, Menlo, 'Ubuntu Mono', monospace",
          cursorBlink: data.settings?.cursorBlink ?? true,
          scrollback: data.settings?.scrollback || 1000,
          rows: 24,
          cols: 80,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // Safe terminal opening
        const openTerminal = () => {
          if (!terminal || !container || terminal.element) return;

          if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            setTimeout(openTerminal, 50);
            return;
          }

          try {
            terminal.open(container);

            // Wait for viewport to be ready before fitting
            const fitTerminal = () => {
              if (!fitAddon || !terminal.element) return;

              const viewport =
                terminal.element.querySelector(".xterm-viewport");
              if (viewport && container.offsetWidth > 0) {
                try {
                  fitAddon.fit();
                } catch (error) {
                  console.warn("Fit error:", error);
                  setTimeout(fitTerminal, 100);
                }
              } else {
                setTimeout(fitTerminal, 50);
              }
            };

            setTimeout(fitTerminal, 200);
          } catch (error) {
            console.error("Failed to open terminal:", error);
            xtermRef.current = null;
            fitAddonRef.current = null;
          }
        };

        requestAnimationFrame(() => setTimeout(openTerminal, 50));

        // Handle terminal events
        terminal.onData((data) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const currentSessionId = sessionState.sessionId;
            const message: TerminalMessage = {
              type: "data",
              sessionId: currentSessionId || "",
              widgetId: widgetIdRef.current,
              data,
            };
            wsRef.current.send(JSON.stringify(message));
          }
        });

        // Handle terminal resize
        terminal.onResize(({ cols, rows }) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const currentSessionId = sessionState.sessionId;
            const message: TerminalMessage = {
              type: "resize",
              sessionId: currentSessionId || "",
              widgetId: widgetIdRef.current,
              cols,
              rows,
            };
            wsRef.current.send(JSON.stringify(message));
          }
        });

        return terminal;
      } catch (error) {
        console.error("Terminal initialization error:", error);
        return null;
      }
    }, [sessionState.sessionId]);

    // Connect to WebSocket - STABLE, minimal dependencies
    const connectWebSocket = useCallback(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return;
      }

      setConnectionState((prev) => ({
        ...prev,
        isConnecting: true,
        error: null,
      }));

      try {
        const wsUrl = `ws://localhost:6080/api/terminal/${widgetIdRef.current}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("Terminal WebSocket connected");
          setConnectionState((prev) => ({
            ...prev,
            isConnecting: false,
            isConnected: true,
            error: null,
            lastConnected: Date.now(),
          }));

          // Create terminal session
          const message: TerminalMessage = {
            type: "create",
            sessionId: "",
            widgetId: widgetIdRef.current,
            cols: 80,
            rows: 24,
            options: {
              shell: currentDataRef.current.shell,
              cwd: currentDataRef.current.cwd,
              env: currentDataRef.current.env,
            },
          };
          ws.send(JSON.stringify(message));
        };

        ws.onmessage = (event) => {
          try {
            const response: TerminalResponse = JSON.parse(event.data);
            handleWebSocketMessage(response);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onclose = () => {
          console.log("Terminal WebSocket disconnected");
          setConnectionState((prev) => ({
            ...prev,
            isConnecting: false,
            isConnected: false,
          }));
          setSessionState((prev) => ({
            ...prev,
            sessionId: null,
            isConnected: false,
          }));
        };

        ws.onerror = (error) => {
          console.error("Terminal WebSocket error:", error);
          setConnectionState((prev) => ({
            ...prev,
            isConnecting: false,
            isConnected: false,
            error: "Connection failed",
          }));
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setConnectionState((prev) => ({
          ...prev,
          isConnecting: false,
          error: "Failed to connect",
        }));
      }
    }, [handleWebSocketMessage]);

    // Initialize terminal and WebSocket connection
    useEffect(() => {
      if (!isContentLoaded || !contentData || isInitializedRef.current) return;

      const initializeAsync = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const terminal = initializeTerminal();
        if (terminal) {
          connectWebSocket();
          isInitializedRef.current = true;
        }
      };

      initializeAsync();
    }, [isContentLoaded, contentData, initializeTerminal, connectWebSocket]);

    // Handle scale changes
    useEffect(() => {
      if (xtermRef.current && fitAddonRef.current && transformScale !== 1) {
        const timeoutId = setTimeout(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (error) {
            console.warn("Fit error on scale change:", error);
          }
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }, [transformScale]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        const currentSessionId = sessionState.sessionId;
        if (currentSessionId && wsRef.current?.readyState === WebSocket.OPEN) {
          const message: TerminalMessage = {
            type: "destroy",
            sessionId: currentSessionId,
            widgetId: widgetIdRef.current,
          };
          wsRef.current.send(JSON.stringify(message));
        }

        if (wsRef.current) {
          wsRef.current.close();
        }

        if (xtermRef.current) {
          xtermRef.current.dispose();
        }
      };
    }, [sessionState.sessionId]);

    // Show loading state
    if (!isContentLoaded) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-gray-400">Loading terminal...</div>
        </div>
      );
    }

    // Show error state
    if (contentError) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-red-400">Error: {contentError}</div>
        </div>
      );
    }

    const data = contentData as TerminalContent;

    return (
      <div className="flex h-full flex-col rounded border border-gray-600 bg-gray-900">
        {/* Header */}
        <div className="border-gray-600 border-b bg-gray-800 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{data.title}</h3>
            <button
              type="button"
              onClick={connectWebSocket}
              className="rounded bg-blue-600 px-2 py-1 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
              disabled={connectionState.isConnecting}
            >
              {connectionState.isConnecting ? "Connecting..." : "Reconnect"}
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-hidden"
          style={{
            backgroundColor: data.theme?.background || "#1a1a1a",
          }}
        />

        {/* Status bar */}
        <div className="border-gray-600 border-t bg-gray-800 px-3 py-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>
              {sessionState.sessionId
                ? `Session: ${sessionState.sessionId.slice(-8)}`
                : "No session"}
            </span>
            <span>
              {data.shell || "default shell"} | {data.cwd || "~"}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

// Backward compatibility flag
(TerminalRenderer as any).selectiveReactivity = true;
;
;


  ;