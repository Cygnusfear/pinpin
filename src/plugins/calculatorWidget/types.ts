import type { BaseWidget } from "../../types/widgets";

export interface CalculatorWidget extends BaseWidget {
  type: "calculator";
  currentValue: string;
  previousValue: string;
  operation: string | null;
  result: string;
  history: string[];
  isResultDisplayed: boolean;
}

export interface CalculatorWidgetCreateData {
  currentValue?: string;
  previousValue?: string;
  operation?: string | null;
  result?: string;
  history?: string[];
  isResultDisplayed?: boolean;
}

export type CalculatorOperation = "+" | "-" | "*" | "/" | null;

export interface CalculatorState {
  currentValue: string;
  previousValue: string;
  operation: CalculatorOperation;
  result: string;
  history: string[];
  isResultDisplayed: boolean;
}