import type React from "react";
import { useCallback, useState } from "react";
import { useContentOperations } from "../../stores/contentStore";
import type { WidgetRendererProps } from "../../types/widgets";
import type { CalculatorWidget } from "./types";

export const CalculatorWidgetRenderer: React.FC<
  WidgetRendererProps<CalculatorWidget>
> = ({ widget, state, events }) => {
  const [pressedButton, setPressedButton] = useState<string | null>(null);
  const { updateContent } = useContentOperations();

  // Get the contentId from the widget (assuming it's stored in the widget)
  const contentId = (widget as any).contentId;

  const handleNumberInput = useCallback((number: string) => {
    let newValue: string;

    if (widget.isResultDisplayed || widget.currentValue === "0") {
      newValue = number;
    } else {
      newValue = widget.currentValue + number;
    }

    console.log('🧮 Updating calculator content (number input):', { newValue, isResultDisplayed: false, contentId });
    
    if (contentId) {
      updateContent(contentId, {
        currentValue: newValue,
        isResultDisplayed: false,
      });
    } else {
      console.warn('🧮 No contentId found for calculator widget');
    }
  },[updateContent, widget, contentId]);

  const handleClear = useCallback(() => {
    console.log('🧮 Updating calculator content (clear):', { contentId });
    
    if (contentId) {
      updateContent(contentId, {
        currentValue: "0",
        isResultDisplayed: false,
      });
    } else {
      console.warn('🧮 No contentId found for calculator widget');
    }
  },[updateContent, contentId]);

  const handleAllClear = useCallback(() => {
    console.log('🧮 Updating calculator content (all clear):', { contentId });
    
    if (contentId) {
      updateContent(contentId, {
        currentValue: "0",
        previousValue: "",
        operation: null,
        result: "",
        isResultDisplayed: false,
      });
    } else {
      console.warn('🧮 No contentId found for calculator widget');
    }
  },[updateContent, contentId]);

  const performCalculation = useCallback((
    previousValue: string,
    currentValue: string,
    operation: string
  ): string => {
    const prev = Number(previousValue);
    const current = Number(currentValue);

    if (!isFinite(prev) || !isFinite(current)) {
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

    // Handle very large or very small numbers
    if (Math.abs(result) >= 1e10 || (Math.abs(result) < 1e-6 && result !== 0)) {
      return result.toExponential(6);
    }

    return result.toString();
  },[]);

    const handleOperationInput = useCallback((operation: string) => {
    let updates: any = {
      operation,
      previousValue: widget.currentValue,
      currentValue: "0",
      isResultDisplayed: false,
    };

    // If there's already an operation and we have both values, calculate first
    if (widget.operation && widget.previousValue && !widget.isResultDisplayed) {
      const result = performCalculation(
        widget.previousValue,
        widget.currentValue,
        widget.operation
      );

      const historyEntry = `${widget.previousValue} ${widget.operation} ${widget.currentValue} = ${result}`;

      updates = {
        ...updates,
        previousValue: result,
        result,
        history: [...widget.history, historyEntry],
      };
    }

    console.log('🧮 Updating calculator content (operation):', { updates, contentId });
    
    if (contentId) {
      updateContent(contentId, updates);
    } else {
      console.warn('🧮 No contentId found for calculator widget');
    }
  },[updateContent, widget, performCalculation, contentId]);

  const handleEqualsInput = useCallback(() => {
    if (!widget.operation || !widget.previousValue) {
      return;
    }

    const result = performCalculation(
      widget.previousValue,
      widget.currentValue,
      widget.operation
    );

    const historyEntry = `${widget.previousValue} ${widget.operation} ${widget.currentValue} = ${result}`;

    const updates = {
      currentValue: result,
      previousValue: "",
      operation: null,
      result,
      isResultDisplayed: true,
      history: [...widget.history, historyEntry],
    };

    console.log('🧮 Updating calculator content (equals):', { updates, contentId });
    
    if (contentId) {
      updateContent(contentId, updates);
    } else {
      console.warn('🧮 No contentId found for calculator widget');
    }
  },[updateContent, widget, performCalculation, contentId]);

  const formatDisplayValue = useCallback((value: string): string => {
    if (value === "Error") return value;
    if (value === "") return "0";
    
    // Limit display length to prevent overflow
    if (value.length > 12) {
      const num = Number(value);
      if (isFinite(num)) {
        return num.toExponential(6);
      }
    }
    
    return value;
  },[]);

  const getButtonClass = (button: string, isPressed: boolean) => {
    const baseClass = "rounded text-sm font-medium transition-all duration-150 active:scale-95";
    
    if (button === "AC" || button === "C") {
      return `${baseClass} bg-gray-200 hover:bg-gray-300 text-gray-800 ${
        isPressed ? "bg-gray-400" : ""
      }`;
    } else if (["+", "-", "*", "/", "="].includes(button)) {
      return `${baseClass} bg-orange-500 hover:bg-orange-600 text-white ${
        isPressed ? "bg-orange-700" : ""
      }`;
    } else {
      return `${baseClass} bg-gray-100 hover:bg-gray-200 text-gray-900 ${
        isPressed ? "bg-gray-300" : ""
      }`;
    }
  };

  const handleButtonPress = useCallback((button: string) => {
    setPressedButton(button);
    setTimeout(() => setPressedButton(null), 150);

    if (button >= "0" && button <= "9") {
      handleNumberInput(button);
    } else if (["+", "-", "*", "/"].includes(button)) {
      handleOperationInput(button);
    } else if (button === "=") {
      handleEqualsInput();
    } else if (button === "C") {
      handleClear();
    } else if (button === "AC") {
      handleAllClear();
    }
  },[handleAllClear, handleClear, handleEqualsInput, handleNumberInput, handleOperationInput]);

  const handleButtonPressEvent = useCallback((event: React.MouseEvent, button: string) => {
    console.log('🧮 Calculator button clicked:', {
      button,
      target: event.target,
      currentTarget: event.currentTarget,
      defaultPrevented: event.defaultPrevented,
      propagationStopped: event.isPropagationStopped?.() || 'unknown'
    });
    
    event.preventDefault();
    event.stopPropagation();
    
    console.log('🧮 After preventDefault/stopPropagation:', {
      defaultPrevented: event.defaultPrevented,
      propagationStopped: event.isPropagationStopped?.() || 'unknown'
    });
    
    handleButtonPress(button);
  },[handleButtonPress]);

  return (
    <div className="flex h-full w-full flex-col bg-gray-50 p-2 z-100">
      {/* Display */}
      <div className="mb-2 flex min-h-0 flex-1 items-end justify-end rounded bg-black px-3 py-2">
        <div className="text-right">
          {/* Previous calculation */}
          {widget.operation && widget.previousValue && (
            <div className="text-gray-400 text-xs">
              {widget.previousValue} {widget.operation}
            </div>
          )}
          {/* Current value */}
          <div className="font-mono text-2xl leading-tight text-white">
            {formatDisplayValue(widget.currentValue)}
          </div>
        </div>
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-4 gap-1">
        {/* Row 1 */}
        <button
          type="button"
          className={`${getButtonClass("AC", pressedButton === "AC")} col-span-2 p-2`}
          onClick={(e) => handleButtonPressEvent(e,"AC")}
        >
          AC
        </button>
        <button
          type="button"
          className={`${getButtonClass("C", pressedButton === "C")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"C")}
        >
          C
        </button>
        <button
          type="button"
          className={`${getButtonClass("/", pressedButton === "/")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"/")}
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          type="button"
          className={`${getButtonClass("7", pressedButton === "7")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"7")}
        >
          7
        </button>
        <button
          type="button"
          className={`${getButtonClass("8", pressedButton === "8")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"8")}
        >
          8
        </button>
        <button
          type="button"
          className={`${getButtonClass("9", pressedButton === "9")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"9")}
        >
          9
        </button>
        <button
          type="button"
          className={`${getButtonClass("*", pressedButton === "*")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"*")}
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          type="button"
          className={`${getButtonClass("4", pressedButton === "4")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"4")}
        >
          4
        </button>
        <button
          type="button"
          className={`${getButtonClass("5", pressedButton === "5")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"5")}
        >
          5
        </button>
        <button
          type="button"
          className={`${getButtonClass("6", pressedButton === "6")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"6")}
        >
          6
        </button>
        <button
          type="button"
          className={`${getButtonClass("-", pressedButton === "-")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"-")}
        >
          −
        </button>

        {/* Row 4 */}
        <button
          type="button"
          className={`${getButtonClass("1", pressedButton === "1")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"1")}
        >
          1
        </button>
        <button
          type="button"
          className={`${getButtonClass("2", pressedButton === "2")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"2")}
        >
          2
        </button>
        <button
          type="button"
          className={`${getButtonClass("3", pressedButton === "3")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,"3")}
        >
          3
        </button>
        <button
          type="button"
          className={`${getButtonClass("+", pressedButton === "+")} row-span-2 p-2`}
          onClick={(e) => handleButtonPressEvent(e,"+")}
        >
          +
        </button>

        {/* Row 5 */}
        <button
          type="button"
          className={`${getButtonClass("0", pressedButton === "0")} col-span-2 p-2`}
          onClick={(e) => handleButtonPressEvent(e,"0")}
        >
          0
        </button>
        <button
          type="button"
          className={`${getButtonClass(".", pressedButton === ".")} p-2`}
          onClick={(e) => handleButtonPressEvent(e,".")}
        >
          .
        </button>
        {/* Empty cell for the + button that spans 2 rows */}

        {/* Row 6 - Equals button */}
        <button
          type="button"
          className={`${getButtonClass("=", pressedButton === "=")} col-span-4 p-2`}
          onClick={(e) => handleButtonPressEvent(e,"=")}
        >
          =
        </button>
      </div>
    </div>
  );
};