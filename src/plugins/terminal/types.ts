/**
 * Terminal Plugin Types
 *
 * Type definitions for the terminal widget plugin
 */

/**
 * Terminal content data structure - ONLY synchronizable configuration
 * Session state (sessionId, isConnected, etc.) should be local-only
 */
export interface TerminalContent {
  title: string;
  shell?: string;
  cwd?: string;
  env?: { [key: string]: string };
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    selection?: string;
  };
  settings?: {
    fontSize?: number;
    fontFamily?: string;
    cursorBlink?: boolean;
    scrollback?: number;
    bellSound?: boolean;
  };
}

/**
 * Terminal session state - LOCAL ONLY, not synchronized
 */
export interface TerminalSessionState {
  sessionId: string | null;
  isConnected: boolean;
  lastActivity: number;
}

/**
 * Terminal WebSocket connection state
 */
export interface TerminalConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  retryCount: number;
  lastConnected: number | null;
}

/**
 * Terminal session options
 */
export interface TerminalSessionOptions {
  shell?: string;
  cwd?: string;
  env?: { [key: string]: string };
  cols?: number;
  rows?: number;
}

/**
 * Terminal WebSocket message types
 */
export interface TerminalMessage {
  type: "create" | "data" | "resize" | "destroy";
  sessionId: string;
  widgetId: string;
  data?: string;
  cols?: number;
  rows?: number;
  options?: TerminalSessionOptions;
}

/**
 * Terminal WebSocket response types
 */
export interface TerminalResponse {
  type: "data" | "exit" | "error" | "created" | "destroyed";
  sessionId: string;
  data?: string;
  exitCode?: number;
  error?: string;
}

/**
 * Terminal size information
 */
export interface TerminalSize {
  cols: number;
  rows: number;
}

/**
 * Terminal theme configuration
 */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent?: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/**
 * Default terminal themes
 */
export const DEFAULT_TERMINAL_THEMES: { [key: string]: TerminalTheme } = {
  dark: {
    background: "#1a1a1a",
    foreground: "#ffffff",
    cursor: "#ffffff",
    selection: "#404040",
    black: "#000000",
    red: "#cd0000",
    green: "#00cd00",
    yellow: "#cdcd00",
    blue: "#0000ee",
    magenta: "#cd00cd",
    cyan: "#00cdcd",
    white: "#e5e5e5",
    brightBlack: "#7f7f7f",
    brightRed: "#ff0000",
    brightGreen: "#00ff00",
    brightYellow: "#ffff00",
    brightBlue: "#5c5cff",
    brightMagenta: "#ff00ff",
    brightCyan: "#00ffff",
    brightWhite: "#ffffff",
  },
  light: {
    background: "#ffffff",
    foreground: "#000000",
    cursor: "#000000",
    selection: "#d4d4d4",
    black: "#000000",
    red: "#cd0000",
    green: "#00cd00",
    yellow: "#cdcd00",
    blue: "#0000ee",
    magenta: "#cd00cd",
    cyan: "#00cdcd",
    white: "#e5e5e5",
    brightBlack: "#7f7f7f",
    brightRed: "#ff0000",
    brightGreen: "#00ff00",
    brightYellow: "#ffff00",
    brightBlue: "#5c5cff",
    brightMagenta: "#ff00ff",
    brightCyan: "#00ffff",
    brightWhite: "#ffffff",
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selection: "#44475a",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
};

/**
 * Terminal event handlers
 */
export interface TerminalEventHandlers {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onTitle: (title: string) => void;
  onBell: () => void;
  onCursorMove: () => void;
  onSelectionChange: () => void;
}

/**
 * Terminal configuration
 */
export interface TerminalConfig {
  websocketUrl: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  defaultShell: string;
  defaultTheme: string;
  allowedShells: string[];
}
