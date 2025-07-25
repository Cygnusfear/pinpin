/**
 * Terminal Widget Renderer
 *
 * React component for rendering terminal widgets using xterm.js
 * Optimized to prevent re-renders and maintain persistent terminal connections
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
} from "./types";

// Import xterm CSS
import "xterm/css/xterm.css";

export const TerminalRenderer: React.FC<WidgetRendererProps> = ({
  widgetId,
}) => {
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

  // Handle WebSocket messages - NO dependencies on widget data
  const handleWebSocketMessage = useCallback((response: TerminalResponse) => {
    const currentData = currentDataRef.current;
    const updateContentFn = updateContentRef.current;
    const contentId = contentIdRef.current;

    switch (response.type) {
      case "created":
        updateContentFn({
          sessionId: response.sessionId,
          isConnected: true,
          lastActivity: Date.now(),
        });
        break;

      case "data":
        if (xtermRef.current && response.data) {
          xtermRef.current.write(response.data);
          // Throttle activity updates
          const now = Date.now();
          if (now - (currentData.lastActivity || 0) > 5000) {
            updateContentFn({
              data: {
                ...currentData,
                lastActivity: now,
              },
            });
          }
        }
        break;

      case "exit":
        console.log("Terminal session exited with code:", response.exitCode);
        if (xtermRef.current) {
          xtermRef.current.write(
            `\r\n\x1b[31mSession exited with code ${response.exitCode}\x1b[0m\r\n`,
          );
        }
        updateContentFn({
          data: {
            ...currentData,
            sessionId: null,
            isConnected: false,
          },
        });
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
        updateContentFn({
          data: {
            ...currentData,
            sessionId: null,
            isConnected: false,
          },
        });
        break;
    }
  }, []); // NO dependencies

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

            const viewport = terminal.element.querySelector(".xterm-viewport");
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
          const message: TerminalMessage = {
            type: "data",
            sessionId: currentDataRef.current.sessionId || "",
            widgetId: widgetIdRef.current,
            data,
          };
          wsRef.current.send(JSON.stringify(message));
        }
      });

      terminal.onResize(({ cols, rows }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const message: TerminalMessage = {
            type: "resize",
            sessionId: currentDataRef.current.sessionId || "",
            widgetId: widgetIdRef.current,
            cols,
            rows,
          };
          wsRef.current.send(JSON.stringify(message));
        }
      });

      return terminal;
    } catch (error) {
      console.error("Failed to initialize terminal:", error);
      xtermRef.current = null;
      fitAddonRef.current = null;
      return null;
    }
  }, []); // NO dependencies

  // Connect WebSocket - STABLE, no dependencies to prevent loops
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) return;

    // Use ref to check connection state to avoid dependency
    const currentConnectionState = connectionStateRef.current;
    if (currentConnectionState.isConnecting) return;

    setConnectionState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/terminal/${widgetIdRef.current}`;
    console.log("Connecting to WebSocket:", wsUrl);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("Terminal WebSocket connected");
        setConnectionState({
          isConnecting: false,
          isConnected: true,
          error: null,
          retryCount: 0,
          lastConnected: Date.now(),
        });

        const data = currentDataRef.current;
        const message: TerminalMessage = {
          type: "create",
          sessionId: "",
          widgetId: widgetIdRef.current,
          cols: xtermRef.current?.cols || 80,
          rows: xtermRef.current?.rows || 24,
          options: {
            shell: data?.shell,
            cwd: data?.cwd,
            env: data?.env,
          },
        };
        ws.send(JSON.stringify(message));
      };

      ws.onmessage = (event) => {
        try {
          const response: TerminalResponse = JSON.parse(event.data);
          handleWebSocketMessage(response);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log(
          "Terminal WebSocket disconnected",
          event.code,
          event.reason,
        );
        setConnectionState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: false,
        }));
        wsRef.current = null;

        // Auto-reconnect with backoff (only for unexpected disconnects)
        if (event.code !== 1000) {
          const currentState = connectionStateRef.current;
          if (currentState.retryCount < 3) {
            const retryDelay = Math.min(
              1000 * 2 ** currentState.retryCount,
              10000,
            );
            console.log(
              `Reconnecting in ${retryDelay}ms (attempt ${currentState.retryCount + 1})`,
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              if (!wsRef.current && terminalRef.current) {
                setConnectionState((prev) => ({
                  ...prev,
                  retryCount: prev.retryCount + 1,
                }));
                connectWebSocket();
              }
            }, retryDelay);
          }
        }
      };

      ws.onerror = (error) => {
        console.error("Terminal WebSocket error:", error);
        setConnectionState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: false,
          error: "WebSocket connection failed",
        }));
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionState((prev) => ({
        ...prev,
        isConnecting: false,
        error: "Failed to create connection",
      }));
    }
  }, [handleWebSocketMessage]); // Only handleWebSocketMessage as dependency

  // Manual reconnect
  const manualReconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState((prev) => ({
      ...prev,
      retryCount: 0,
      error: null,
    }));

    connectWebSocket();
  }, [connectWebSocket]);

  // Handle widget resize - only scale changes
  useEffect(() => {
    if (fitAddonRef.current && xtermRef.current && transformScale) {
      const timeoutId = setTimeout(() => {
        try {
          if (fitAddonRef.current && terminalRef.current?.offsetHeight > 0) {
            fitAddonRef.current.fit();
          }
        } catch (error) {
          console.warn("Failed to fit terminal on resize:", error);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [transformScale]);

  // Initialize terminal ONCE on mount - NO widget data dependencies
  useEffect(() => {
    if (isInitializedRef.current) return;

    const checkContainer = () => {
      if (terminalRef.current && terminalRef.current.offsetWidth > 0) {
        const terminal = initializeTerminal();
        if (terminal) {
          isInitializedRef.current = true;
          setTimeout(connectWebSocket, 100);
        } else {
          setTimeout(checkContainer, 100);
        }
      } else {
        setTimeout(checkContainer, 50);
      }
    };

    checkContainer();

    return () => {
      // Cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          const message: TerminalMessage = {
            type: "destroy",
            sessionId: currentDataRef.current.sessionId || "",
            widgetId: widgetIdRef.current,
          };
          wsRef.current.send(JSON.stringify(message));
          wsRef.current.close();
        } catch (error) {
          console.warn("Error during WebSocket cleanup:", error);
        }
      }
      wsRef.current = null;

      if (xtermRef.current) {
        try {
          xtermRef.current.dispose();
        } catch (error) {
          console.warn("Error disposing terminal:", error);
        }
        xtermRef.current = null;
      }

      fitAddonRef.current = null;
      isInitializedRef.current = false;
    };
  }, [initializeTerminal, connectWebSocket]); // Only stable functions, NO widget data

  // Loading state
  if (!isContentLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100 shadow">
        <div className="text-gray-500">Loading terminal...</div>
      </div>
    );
  }

  // Error state
  if (contentError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-red-100 shadow">
        <div className="text-red-500">Error: {contentError}</div>
      </div>
    );
  }

  const data = contentData;

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100 shadow">
        <div className="text-gray-500">No terminal data available</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-300 bg-black shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-gray-600 border-b bg-gray-800 px-3 py-2">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm text-white">🖥️ {data.title}</span>
          <div
            className={`h-2 w-2 rounded-full ${
              connectionState.isConnected
                ? "bg-green-500"
                : connectionState.isConnecting
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
        </div>
        <div className="flex items-center space-x-2">
          {connectionState.error && (
            <span className="text-red-400 text-xs">
              {connectionState.error}
            </span>
          )}
          <button
            type="button"
            onClick={manualReconnect}
            className="text-gray-400 text-xs hover:text-white"
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
            {data.sessionId
              ? `Session: ${data.sessionId.slice(-8)}`
              : "No session"}
          </span>
          <span>
            {data.shell || "default shell"} | {data.cwd || "~"}
          </span>
        </div>
      </div>
    </div>
  );
};

// Backward compatibility flag
(TerminalRenderer as any).selectiveReactivity = true;
