import type React from "react";
import { useCallback } from "react";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { SelectiveWidgetRendererProps } from "../../types/widgets";
import type { CalculatorContent } from "./types";

// ============================================================================
// CALCULATOR WIDGET RENDERER - SELECTIVE REACTIVITY
// ============================================================================

const BUTTON_STYLE =
  "flex-1 h-12 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-lg font-medium transition-colors";
const OPERATOR_STYLE =
  "flex-1 h-12 bg-blue-500 hover:bg-blue-600 text-white border border-blue-600 rounded text-lg font-medium transition-colors";
const EQUALS_STYLE =
  "flex-1 h-12 bg-green-500 hover:bg-green-600 text-white border border-green-600 rounded text-lg font-medium transition-colors";

export const CalculatorRenderer: React.FC<SelectiveWidgetRendererProps> = ({
  widgetId,
}) => {
  // Selective subscriptions - only re-render when these specific values change
  const currentValue = useWidgetContent(
    widgetId,
    (content) => content.data.currentValue,
  );
  const previousValue = useWidgetContent(
    widgetId,
    (content) => content.data.previousValue,
  );
  const operation = useWidgetContent(
    widgetId,
    (content) => content.data.operation,
  );
  const isResultDisplayed = useWidgetContent(
    widgetId,
    (content) => content.data.isResultDisplayed,
  );
  const result = useWidgetContent(widgetId, (content) => content.data.result);
  const history = useWidgetContent(widgetId, (content) => content.data.history);

  // Get update actions
  const { updateContent } = useWidgetActions(widgetId);

  const handleButtonClick = useCallback(
    (value: string) => {
      if (!currentValue || !history) return;

      let newData = {
        currentValue,
        previousValue: previousValue || "",
        operation: operation || null,
        isResultDisplayed: isResultDisplayed || false,
        result: result || "",
        history: history || [],
      };

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
            let calcResult = 0;

            switch (newData.operation) {
              case "+":
                calcResult = prev + current;
                break;
              case "-":
                calcResult = prev - current;
                break;
              case "*":
                calcResult = prev * current;
                break;
              case "/":
                calcResult = current !== 0 ? prev / current : 0;
                break;
            }

            const resultString = calcResult.toString();
            newData = {
              ...newData,
              currentValue: resultString,
              result: resultString,
              previousValue: "",
              operation: null,
              isResultDisplayed: true,
              history: [
                ...newData.history,
                `${prev} ${newData.operation} ${current} = ${calcResult}`,
              ],
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

      updateContent(newData);
    },
    [
      currentValue,
      previousValue,
      operation,
      isResultDisplayed,
      result,
      history,
      updateContent,
    ],
  );

  // Loading state
  if (!currentValue || !history) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white shadow">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow">
      {/* Display */}
      <div className="bg-gray-800 p-4 text-right text-white">
        <div className="font-mono text-2xl">{currentValue}</div>
        <div className="min-h-5 text-gray-300 text-sm">
          {previousValue} {operation}
        </div>
      </div>

      {/* Buttons */}
      <div className="grid flex-1 grid-cols-4 gap-1 p-2">
        {/* Row 1 */}
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("C")}
        >
          C
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("±")}
        >
          ±
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("%")}
        >
          %
        </button>
        <button
          type="button"
          className={OPERATOR_STYLE}
          onClick={() => handleButtonClick("/")}
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("7")}
        >
          7
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("8")}
        >
          8
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("9")}
        >
          9
        </button>
        <button
          type="button"
          className={OPERATOR_STYLE}
          onClick={() => handleButtonClick("*")}
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("4")}
        >
          4
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("5")}
        >
          5
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("6")}
        >
          6
        </button>
        <button
          type="button"
          className={OPERATOR_STYLE}
          onClick={() => handleButtonClick("-")}
        >
          −
        </button>

        {/* Row 4 */}
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("1")}
        >
          1
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("2")}
        >
          2
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick("3")}
        >
          3
        </button>
        <button
          type="button"
          className={OPERATOR_STYLE}
          onClick={() => handleButtonClick("+")}
        >
          +
        </button>

        {/* Row 5 */}
        <button
          type="button"
          className={`${BUTTON_STYLE} col-span-2`}
          onClick={() => handleButtonClick("0")}
        >
          0
        </button>
        <button
          type="button"
          className={BUTTON_STYLE}
          onClick={() => handleButtonClick(".")}
        >
          .
        </button>
        <button
          type="button"
          className={EQUALS_STYLE}
          onClick={() => handleButtonClick("=")}
        >
          =
        </button>
      </div>
    </div>
  );
};

// Mark this component as using selective reactivity
(CalculatorRenderer as any).selectiveReactivity = true;
