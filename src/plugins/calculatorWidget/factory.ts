import { getGenericWidgetFactory } from "../../core/GenericWidgetFactory";
import type {
  WidgetCapabilities,
  WidgetCreateData,
  WidgetExportData,
  WidgetFactory,
  WidgetSerializationOptions,
  WidgetValidationResult,
} from "../../types/widgets";
import type { CalculatorWidget } from "./types";

export class CalculatorWidgetFactory implements WidgetFactory<CalculatorWidget> {
  type = "calculator";

  canHandle(data: any): boolean {
    // Calculator widgets are created manually via UI, not from dropped/pasted data
    // However, we can handle objects that explicitly request a calculator
    if (typeof data === "object" && data !== null) {
      return data.type === "calculator" || data.calculator === true;
    }
    
    // Handle string commands for calculator creation
    if (typeof data === "string") {
      const cleanData = data.trim().toLowerCase();
      return cleanData === "calculator" || cleanData === "calc";
    }

    return false;
  }

  async create(
    data: any,
    position: { x: number; y: number },
  ): Promise<WidgetCreateData<CalculatorWidget>> {
    // Initialize calculator state
    let currentValue = "0";
    let previousValue = "";
    let operation: string | null = null;
    let result = "";
    let history: string[] = [];
    let isResultDisplayed = false;

    // If data contains initial calculator state, use it
    if (typeof data === "object" && data !== null) {
      currentValue = data.currentValue || "0";
      previousValue = data.previousValue || "";
      operation = data.operation || null;
      result = data.result || "";
      history = Array.isArray(data.history) ? data.history : [];
      isResultDisplayed = data.isResultDisplayed || false;
    }

    // Get default size for calculator
    const size = this.getDefaultSize();

    // Get default widget data from GenericWidgetFactory
    const genericFactory = getGenericWidgetFactory();
    const defaultData = genericFactory.getDefaultWidgetData(
      "calculator",
      position,
      size,
    );

    // Create calculator widget data
    const widgetData: WidgetCreateData<CalculatorWidget> = {
      ...defaultData,
      currentValue,
      previousValue,
      operation,
      result,
      history,
      isResultDisplayed,
      metadata: {
        ...defaultData.metadata,
        calculatorVersion: "1.0.0",
        createdFrom: typeof data === "string" ? "command" : "object",
        lastUsed: Date.now(),
      },
    } as WidgetCreateData<CalculatorWidget>;

    return widgetData;
  }

  validate(widget: CalculatorWidget): WidgetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic widget properties
    if (widget.width <= 0 || widget.height <= 0) {
      errors.push("Calculator dimensions must be positive");
    }

    // Validate calculator-specific properties
    if (typeof widget.currentValue !== "string") {
      errors.push("Current value must be a string");
    }

    if (typeof widget.previousValue !== "string") {
      errors.push("Previous value must be a string");
    }

    if (widget.operation !== null && 
        !["+" , "-", "*", "/"].includes(widget.operation)) {
      errors.push("Operation must be one of: +, -, *, /, or null");
    }

    if (typeof widget.result !== "string") {
      errors.push("Result must be a string");
    }

    if (!Array.isArray(widget.history)) {
      errors.push("History must be an array");
    }

    if (typeof widget.isResultDisplayed !== "boolean") {
      errors.push("isResultDisplayed must be a boolean");
    }

    // Validate numeric values
    if (widget.currentValue !== "0" && widget.currentValue !== "" && 
        isNaN(Number(widget.currentValue))) {
      warnings.push("Current value is not a valid number");
    }

    if (widget.previousValue !== "" && isNaN(Number(widget.previousValue))) {
      warnings.push("Previous value is not a valid number");
    }

    if (widget.result !== "" && isNaN(Number(widget.result))) {
      warnings.push("Result is not a valid number");
    }

    // Check history size
    if (widget.history.length > 100) {
      warnings.push("Calculator history is very long and may affect performance");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async serialize(
    widget: CalculatorWidget,
    _options: WidgetSerializationOptions,
  ): Promise<WidgetExportData> {
    return {
      widget: { ...widget },
    };
  }

  async deserialize(data: WidgetExportData): Promise<CalculatorWidget> {
    return data.widget as CalculatorWidget;
  }

  getDefaultSize(): { width: number; height: number } {
    return { width: 240, height: 320 };
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false, // Calculator should stay upright for usability
      canEdit: false, // Calculator state is modified through interaction, not editing
      canConfigure: true, // Could allow theme/color customization
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: false, // Calculator has its own built-in controls
      hasInspector: true, // Could show calculation history
    };
  }

  // Helper methods for calculator operations
  isValidNumber(value: string): boolean {
    return !isNaN(Number(value)) && isFinite(Number(value));
  }

  formatNumber(value: string | number): string {
    const num = typeof value === "string" ? Number(value) : value;
    if (!isFinite(num)) return "Error";
    
    // Handle very large or very small numbers
    if (Math.abs(num) >= 1e10 || (Math.abs(num) < 1e-6 && num !== 0)) {
      return num.toExponential(6);
    }
    
    // Format with appropriate decimal places
    return num.toString();
  }

  performCalculation(
    previousValue: string,
    currentValue: string,
    operation: string,
  ): string {
    const prev = Number(previousValue);
    const current = Number(currentValue);

    if (!this.isValidNumber(previousValue) || !this.isValidNumber(currentValue)) {
      return "Error";
    }

    let result: number;
    switch (operation) {
      case "+":
        result = prev + current;
        break;
      case "-":
        result = prev - current;
        break;
      case "*":
        result = prev * current;
        break;
      case "/":
        if (current === 0) return "Error";
        result = prev / current;
        break;
      default:
        return "Error";
    }

    return this.formatNumber(result);
  }

  // Public utility methods for calculator state management
  handleNumberInput(
    widget: CalculatorWidget,
    number: string,
  ): Partial<CalculatorWidget> {
    let newValue: string;

    if (widget.isResultDisplayed || widget.currentValue === "0") {
      newValue = number;
    } else {
      newValue = widget.currentValue + number;
    }

    return {
      currentValue: newValue,
      isResultDisplayed: false,
    };
  }

  handleOperationInput(
    widget: CalculatorWidget,
    operation: string,
  ): Partial<CalculatorWidget> {
    let updates: Partial<CalculatorWidget> = {
      operation,
      previousValue: widget.currentValue,
      currentValue: "0",
      isResultDisplayed: false,
    };

    // If there's already an operation and we have both values, calculate first
    if (widget.operation && widget.previousValue && !widget.isResultDisplayed) {
      const result = this.performCalculation(
        widget.previousValue,
        widget.currentValue,
        widget.operation,
      );
      
      const historyEntry = `${widget.previousValue} ${widget.operation} ${widget.currentValue} = ${result}`;
      
      updates = {
        ...updates,
        previousValue: result,
        result,
        history: [...widget.history, historyEntry],
      };
    }

    return updates;
  }

  handleEqualsInput(widget: CalculatorWidget): Partial<CalculatorWidget> {
    if (!widget.operation || !widget.previousValue) {
      return {};
    }

    const result = this.performCalculation(
      widget.previousValue,
      widget.currentValue,
      widget.operation,
    );

    const historyEntry = `${widget.previousValue} ${widget.operation} ${widget.currentValue} = ${result}`;

    return {
      currentValue: result,
      previousValue: "",
      operation: null,
      result,
      isResultDisplayed: true,
      history: [...widget.history, historyEntry],
    };
  }

  handleClear(widget: CalculatorWidget): Partial<CalculatorWidget> {
    return {
      currentValue: "0",
      isResultDisplayed: false,
    };
  }

  handleAllClear(widget: CalculatorWidget): Partial<CalculatorWidget> {
    return {
      currentValue: "0",
      previousValue: "",
      operation: null,
      result: "",
      isResultDisplayed: false,
      // Keep history for reference
    };
  }
}