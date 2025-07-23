import type {
  WidgetPlugin,
  WidgetTypeDefinition,
} from "../../types/widgets";
import { CalculatorFactory } from "./factory";
import { CalculatorRenderer } from "./renderer";

// ============================================================================
// CALCULATOR WIDGET PLUGIN - CLEAN IMPLEMENTATION
// ============================================================================

export const calculatorTypeDefinition: WidgetTypeDefinition[] = [{
  type: "calculator",
  name: "Calculator",
  description: "A functional calculator for basic math operations",
  icon: "🧮",
  category: "app",
  defaultSize: { width: 280, height: 360 },
  minSize: { width: 240, height: 320 },
  maxSize: { width: 400, height: 500 },
  aspectRatioLocked: false,
  resizable: true,
  rotatable: false,
  configurable: true,
}];

export class CalculatorPlugin implements WidgetPlugin {
  id = "calculator";
  name = "Calculator Widget";
  version = "1.0.0";
  description = "A functional calculator widget for basic math operations";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = calculatorTypeDefinition;

  factories = [new CalculatorFactory()];
  renderers = [{ type: "calculator", component: CalculatorRenderer }];

  async install(registry: any): Promise<void> {
    // Register type definition
    this.types.forEach(type => registry.registerType(type));
    
    // Register factory
    this.factories.forEach(factory => registry.registerFactory(factory));
    
    // Register renderer
    this.renderers.forEach(renderer => registry.registerRenderer(renderer));
    
    console.log(`✅ Installed ${this.name} v${this.version}`);
  }

  async uninstall(registry: any): Promise<void> {
    // Unregister in reverse order
    this.renderers.forEach(renderer => registry.unregisterRenderer(renderer.type));
    this.factories.forEach(factory => registry.unregisterFactory(factory.type));
    this.types.forEach(type => registry.unregisterType(type.type));
    
    console.log(`❌ Uninstalled ${this.name}`);
  }
}

// Export plugin instance
export const calculatorPlugin = new CalculatorPlugin();

// Export individual components for flexibility
export { CalculatorFactory } from "./factory";
export { CalculatorRenderer } from "./renderer";