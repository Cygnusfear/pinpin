/**
 * Terminal Widget Factory
 *
 * Creates terminal widgets following the Pinboard plugin architecture
 */

import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
  WidgetValidationResult,
} from "../../types/widgets";
import type { TerminalContent } from "./types";

export class TerminalFactory implements WidgetFactory<TerminalContent> {
  type = "terminal";

  /**
   * Determines if this factory can handle the provided data
   */
  canHandle(data: any): boolean {
    // Handle explicit terminal requests
    if (data?.type === "terminal") {
      return true;
    }

    // Handle terminal-specific strings
    if (typeof data === "string") {
      const terminalKeywords = [
        "terminal",
        "shell",
        "bash",
        "cmd",
        "powershell",
        "zsh",
        "fish",
        "claude",
        "/usr/bin/",
        "~/",
      ];

      const lowerData = data.toLowerCase();
      return terminalKeywords.some((keyword) => lowerData.includes(keyword));
    }

    // Handle command objects
    if (
      data &&
      typeof data === "object" &&
      (data.command || data.shell || data.cwd)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create a terminal widget from the provided data
   */
  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let title = "Terminal";
    let shell: string | undefined;
    let cwd: string | undefined;
    let env: { [key: string]: string } | undefined;

    // Process different data types
    if (typeof data === "string") {
      // Extract useful information from string
      if (data.toLowerCase().includes("claude")) {
        title = "Claude Terminal";
        // Set environment variables to ensure Claude CLI is available
        env = {
          PATH: process.env.PATH || "",
          CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
        };
      } else if (data.toLowerCase().includes("powershell")) {
        title = "PowerShell";
        shell = "powershell.exe";
      } else if (data.toLowerCase().includes("bash")) {
        title = "Bash";
        shell = "/bin/bash";
      } else if (data.toLowerCase().includes("zsh")) {
        title = "Zsh";
        shell = "/bin/zsh";
      } else if (data.toLowerCase().includes("fish")) {
        title = "Fish";
        shell = "/usr/bin/fish";
      } else if (data.startsWith("~/")) {
        title = "Terminal";
        cwd = data.replace("~/", process.env.HOME || "~");
      } else if (data.startsWith("/")) {
        title = "Terminal";
        cwd = data;
      } else {
        title = data;
      }
    } else if (data && typeof data === "object") {
      title = data.title || data.name || "Terminal";
      shell = data.shell;
      cwd = data.cwd || data.workingDirectory;
      env = data.env || data.environment;
    }

    const terminalContent: TerminalContent = {
      sessionId: null,
      title,
      ...(shell && { shell }),
      ...(cwd && { cwd }),
      ...(env && { env }),
      isConnected: false,
      lastActivity: Date.now(),
      theme: {
        background: "#1a1a1a",
        foreground: "#ffffff",
        cursor: "#ffffff",
        selection: "#404040",
      },
      settings: {
        fontSize: 14,
        fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
        cursorBlink: true,
        scrollback: 1000,
        bellSound: false,
      },
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 600,
      height: 400,
      content: terminalContent,
    };
  }

  /**
   * Get demo defaults for manual widget creation
   */
  getDemoDefaults(): TerminalContent {
    return {
      sessionId: null,
      title: "Demo Terminal",
      isConnected: false,
      lastActivity: Date.now(),
      theme: {
        background: "#1a1a1a",
        foreground: "#ffffff",
        cursor: "#ffffff",
        selection: "#404040",
      },
      settings: {
        fontSize: 14,
        fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
        cursorBlink: true,
        scrollback: 1000,
        bellSound: false,
      },
    };
  }

  /**
   * Get default size for the widget
   */
  getDefaultSize(): { width: number; height: number } {
    return { width: 600, height: 400 };
  }

  /**
   * Define what capabilities this widget has
   */
  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false, // Terminals work better without rotation
      canEdit: false, // Terminal content is interactive, not editable
      canConfigure: true,
      canGroup: true,
      canDuplicate: true,
      canExport: false, // Terminal sessions are not exportable
      hasContextMenu: true,
      hasToolbar: true,
      hasInspector: true,
    };
  }

  /**
   * Validate terminal widget content
   */
  validate(widget: HydratedWidget<TerminalContent>): WidgetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Terminal content is missing");
      return { isValid: false, errors, warnings };
    }

    const data = widget.content.data;

    // Validate required fields
    if (!data.title || typeof data.title !== "string") {
      errors.push("Terminal title is required and must be a string");
    }

    if (typeof data.isConnected !== "boolean") {
      errors.push("isConnected must be a boolean");
    }

    if (typeof data.lastActivity !== "number") {
      errors.push("lastActivity must be a number");
    }

    // Validate optional shell path
    if (data.shell && typeof data.shell !== "string") {
      errors.push("Shell must be a string if provided");
    }

    // Validate optional working directory
    if (data.cwd && typeof data.cwd !== "string") {
      errors.push("Working directory must be a string if provided");
    }

    // Validate environment variables
    if (data.env && (typeof data.env !== "object" || Array.isArray(data.env))) {
      errors.push("Environment variables must be an object if provided");
    }

    // Validate theme
    if (data.theme) {
      if (typeof data.theme !== "object") {
        errors.push("Theme must be an object if provided");
      } else {
        const themeProps = ["background", "foreground", "cursor", "selection"];
        for (const prop of themeProps) {
          if (data.theme[prop] && typeof data.theme[prop] !== "string") {
            errors.push(`Theme ${prop} must be a string if provided`);
          }
        }
      }
    }

    // Validate settings
    if (data.settings) {
      if (typeof data.settings !== "object") {
        errors.push("Settings must be an object if provided");
      } else {
        if (
          data.settings.fontSize &&
          typeof data.settings.fontSize !== "number"
        ) {
          errors.push("Font size must be a number if provided");
        }
        if (
          data.settings.fontFamily &&
          typeof data.settings.fontFamily !== "string"
        ) {
          errors.push("Font family must be a string if provided");
        }
        if (
          data.settings.scrollback &&
          typeof data.settings.scrollback !== "number"
        ) {
          errors.push("Scrollback must be a number if provided");
        }
      }
    }

    // Add warnings for potential issues
    if (data.sessionId && !data.isConnected) {
      warnings.push("Terminal has a session ID but is not connected");
    }

    if (data.shell && !data.shell.includes("/") && !data.shell.includes("\\")) {
      warnings.push(
        "Shell path may not be absolute - consider using full path",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
