import React, { useCallback } from "react";
import type {
  WidgetRendererProps,
  CalculatorContent,
} from "../../types/widgets";
import { useContentActions } from "../../stores/widgetStore";

// ============================================================================
// CALCULATOR WIDGET RENDERER - CLEAN IMPLEMENTATION
// ============================================================================

const BUTTON_STYLE = "flex-1 h-12 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-lg font-medium transition-colors";
const OPERATOR_STYLE = "flex-1 h-12 bg-blue-500 hover:bg-blue-600 text-white border border-blue-600 rounded text-lg font-medium transition-colors";
const EQUALS_STYLE = "flex-1 h-12 bg-green-500 hover:bg-green-600 text-white border border-green-600 rounded text-lg font-medium transition-colors";

export const CalculatorRenderer: React.FC<WidgetRendererProps<CalculatorContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();

  const handleButtonClick = useCallback((value: string) => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    const data = widget.content.data;
    let newData = { ...data };

    if (value === "C") {
      // Clear
      newData = {
        ...newData,
        currentValue: "0",
        previousValue: "",
        operation: null,
        isResultDisplayed: false,
      };
    } else if (value === "=") {
      // Calculate result
      if (newData.operation && newData.previousValue) {
        try {
          const prev = parseFloat(newData.previousValue);
          const current = parseFloat(newData.currentValue);
          let result = 0;

          switch (newData.operation) {
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
              result = current !== 0 ? prev / current : 0;
              break;
          }

          const resultString = result.toString();
          newData = {
            ...newData,
            currentValue: resultString,
            result: resultString,
            previousValue: "",
            operation: null,
            isResultDisplayed: true,
            history: [...newData.history, `${prev} ${newData.operation} ${current} = ${result}`],
          };
        } catch (error) {
          console.error("Calculation error:", error);
        }
      }
    } else if (["+", "-", "*", "/"].includes(value)) {
      // Operation
      newData = {
        ...newData,
        operation: value,
        previousValue: newData.currentValue,
        isResultDisplayed: false,
      };
    } else {
      // Number
      if (newData.isResultDisplayed || newData.currentValue === "0") {
        newData = {
          ...newData,
          currentValue: value,
          isResultDisplayed: false,
        };
      } else {
        newData = {
          ...newData,
          currentValue: newData.currentValue + value,
        };
      }
    }

    updateContent(widget.contentId, { data: newData });
  }, [widget, updateContent]);

  if (!widget.isContentLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg shadow">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (widget.contentError) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg shadow">
        <div className="text-red-500">Error: {widget.contentError}</div>
      </div>
    );
  }

  const data = widget.content.data;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden">
      {/* Display */}
      <div className="bg-gray-800 text-white p-4 text-right">
        <div className="text-2xl font-mono">{data.currentValue}</div>
        {data.operation && (
          <div className="text-sm text-gray-300">
            {data.previousValue} {data.operation}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex-1 p-2 grid grid-cols-4 gap-1">
        {/* Row 1 */}
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("C")}>
          C
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("±")}>
          ±
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("%")}>
          %
        </button>
        <button className={OPERATOR_STYLE} onClick={() => handleButtonClick("/")}>
          ÷
        </button>

        {/* Row 2 */}
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("7")}>
          7
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("8")}>
          8
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("9")}>
          9
        </button>
        <button className={OPERATOR_STYLE} onClick={() => handleButtonClick("*")}>
          ×
        </button>

        {/* Row 3 */}
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("4")}>
          4
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("5")}>
          5
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("6")}>
          6
        </button>
        <button className={OPERATOR_STYLE} onClick={() => handleButtonClick("-")}>
          −
        </button>

        {/* Row 4 */}
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("1")}>
          1
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("2")}>
          2
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick("3")}>
          3
        </button>
        <button className={OPERATOR_STYLE} onClick={() => handleButtonClick("+")}>
          +
        </button>

        {/* Row 5 */}
        <button
          className={`${BUTTON_STYLE} col-span-2`}
          onClick={() => handleButtonClick("0")}
        >
          0
        </button>
        <button className={BUTTON_STYLE} onClick={() => handleButtonClick(".")}>
          .
        </button>
        <button className={EQUALS_STYLE} onClick={() => handleButtonClick("=")}>
          =
        </button>
      </div>
    </div>
  );
};