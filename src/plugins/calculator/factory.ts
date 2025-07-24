import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
} from "../../types/widgets";
import { calculatorTypeDefinition } from ".";
import type { CalculatorContent } from "./types";

// ============================================================================
// CALCULATOR WIDGET FACTORY - CLEAN IMPLEMENTATION
// ============================================================================

export class CalculatorFactory implements WidgetFactory<CalculatorContent> {
  type = "calculator";

  canHandle(data: any): boolean {
    // Handle explicit calculator requests
    if (data?.type === "calculator" || data?.calculator === true) {
      return true;
    }

    // Handle math expressions or calculator-like input
    if (typeof data === "string") {
      const mathPattern = /^[\d+\-*\/\(\)\.\s]+$/;
      return mathPattern.test(data.trim()) && data.trim().length > 0;
    }

    return false;
  }

  getDemoDefaults(): any {
    return {
      type: "calculator",
      calculator: true,
    };
  }

  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let initialValue = "0";

    // If data is a math expression, set it as the current value
    if (typeof data === "string" && this.canHandle(data)) {
      try {
        // Safely evaluate the expression
        const result = Function(`"use strict"; return (${data})`)();
        initialValue = result.toString();
      } catch (error) {
        // If evaluation fails, use the input as is
        initialValue = data.trim();
      }
    }

    const content: CalculatorContent = {
      currentValue: initialValue,
      previousValue: "",
      operation: null,
      result: initialValue,
      history: [],
      isResultDisplayed: false,
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: calculatorTypeDefinition[0].defaultSize.width,
      height: calculatorTypeDefinition[0].defaultSize.height,
      content,
    };
  }

  getDefaultSize(): { width: number; height: number } {
    return calculatorTypeDefinition[0].defaultSize;
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false,
      canEdit: false,
      canConfigure: true,
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: false,
      hasInspector: true,
    };
  }

  validate(widget: HydratedWidget<CalculatorContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Calculator content is missing");
    } else {
      const data = widget.content.data;
      if (typeof data.currentValue !== "string") {
        errors.push("Current value must be a string");
      }
      if (typeof data.previousValue !== "string") {
        errors.push("Previous value must be a string");
      }
      if (!Array.isArray(data.history)) {
        errors.push("History must be an array");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
