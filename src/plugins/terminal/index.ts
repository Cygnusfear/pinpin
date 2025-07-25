/**
 * Terminal Plugin
 *
 * A terminal widget plugin that provides real shell access through xterm.js and node-pty
 */

import type {
  WidgetPlugin,
  WidgetRegistry,
  WidgetRenderer,
  WidgetTypeDefinition,
} from "../../types/widgets";
import { TerminalFactory } from "./factory";
import { TerminalRenderer } from "./renderer";

export const terminalTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "terminal",
    name: "Terminal",
    description:
      "Interactive terminal with shell access for running commands and Claude CLI",
    icon: "🖥️",
    category: "app",
    defaultSize: { width: 600, height: 400 },
    minSize: { width: 400, height: 300 },
    maxSize: { width: 1200, height: 800 },
    aspectRatioLocked: false,
    resizable: true,
    rotatable: false, // Terminals work better without rotation
    configurable: true,
    autoCreateOnly: false,
  },
];

export class TerminalPlugin implements WidgetPlugin {
  id = "terminal";
  name = "Terminal";
  version = "1.0.0";
  description =
    "Interactive terminal widget with shell access and Claude CLI integration";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = terminalTypeDefinition;
  factories = [new TerminalFactory()];
  renderers: WidgetRenderer[] = [
    {
      type: "terminal",
      component: TerminalRenderer,
    },
  ];

  async install(registry: WidgetRegistry): Promise<void> {
    // Register type definition
    this.types.forEach((type) => registry.registerType(type));

    // Register factory
    this.factories.forEach((factory) => registry.registerFactory(factory));

    // Register renderer
    this.renderers.forEach((renderer) => registry.registerRenderer(renderer));

    console.log(`✅ Installed ${this.name} v${this.version}`);
  }

  async uninstall(registry: WidgetRegistry): Promise<void> {
    // Unregister in reverse order
    this.renderers.forEach((renderer) =>
      registry.unregisterRenderer(renderer.type),
    );
    this.factories.forEach((factory) =>
      registry.unregisterFactory(factory.type),
    );
    this.types.forEach((type) => registry.unregisterType(type.type));

    console.log(`❌ Uninstalled ${this.name}`);
  }
}

// Export plugin instance
export const terminalPlugin = new TerminalPlugin();

// Export individual components for flexibility
export { TerminalFactory } from "./factory";
export { TerminalRenderer } from "./renderer";
export * from "./types";
