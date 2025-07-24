/**
 * Calculator widget content
 */
export interface CalculatorContent {
  currentValue: string;
  previousValue: string;
  operation: string | null;
  result: string;
  history: string[];
  isResultDisplayed: boolean;
}
