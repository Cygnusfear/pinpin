import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { CalculatorWidgetFactory } from "./factory";
import { CalculatorWidgetRenderer } from "./renderer";

export class CalculatorWidgetPlugin implements WidgetPlugin {
  id = "calculator-widget";
  name = "Calculator Widget";
  version = "1.0.0";
  description = "A fully functional calculator widget for basic arithmetic operations";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = [
    {
      type: "calculator",
      name: "Calculator",
      description: "A calculator for basic arithmetic operations",
      icon: "🧮",
      category: "app",
      defaultSize: { width: 240, height: 320 },
      minSize: { width: 200, height: 280 },
      maxSize: { width: 300, height: 400 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: false, // Calculators should stay upright for usability
      configurable: true,
    },
  ];

  factories = [new CalculatorWidgetFactory()];

  renderers = [
    {
      type: "calculator",
      component: CalculatorWidgetRenderer,
    },
  ];

  async install(): Promise<void> {
    console.log(`Installing ${this.name} v${this.version}...`);
  }

  async uninstall(): Promise<void> {
    console.log(`Uninstalling ${this.name}...`);
  }
}

// Export plugin instance and components
export const calculatorWidgetPlugin = new CalculatorWidgetPlugin();
export { CalculatorWidgetFactory } from "./factory";
export { CalculatorWidgetRenderer } from "./renderer";
export type { CalculatorWidget, CalculatorWidgetCreateData } from "./types";