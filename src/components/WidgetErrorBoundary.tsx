import type React from "react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widgetId: string;
  widgetType: string;
  fallback?: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Error Boundary specifically designed for widget containers.
 * 
 * When a plugin/widget crashes due to LLM-generated code errors:
 * - Only the individual widget fails, not the whole pinboard
 * - Shows a helpful error UI with debugging information
 * - Allows users to continue using other widgets
 * - Provides recovery options
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('🚨 Widget Error Boundary caught an error:', {
      widgetId: this.props.widgetId,
      widgetType: this.props.widgetType,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Update state with error info for debugging display
    this.setState({
      error,
      errorInfo,
    });

    // Optional: Send error to monitoring service
    // trackError('widget_crash', {
    //   widgetId: this.props.widgetId,
    //   widgetType: this.props.widgetType,
    //   error: error.message,
    // });
  }

  private handleRetry = () => {
    // Clear error state to retry rendering
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  private handleReportError = () => {
    const { widgetId, widgetType } = this.props;
    const { error } = this.state;
    
    // Create error report data
    const errorReport = {
      widgetId,
      widgetType,
      error: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    // Copy to clipboard for easy reporting
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        alert('Error details copied to clipboard. Please share with the development team.');
      })
      .catch(() => {
        console.log('Error report:', errorReport);
        alert('Error details logged to console. Please share with the development team.');
      });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI or use default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error } = this.state;
      const { widgetType, widgetId } = this.props;

      // Default error UI that matches widget styling
      return (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center bg-red-50 border border-red-200 rounded">
          <div className="mb-3 text-3xl">💥</div>
          
          <div className="mb-2 font-semibold text-red-700 text-sm">
            Widget Crashed
          </div>
          
          <div className="mb-2 text-gray-600 text-xs">
            Plugin "{widgetType}" encountered an error
          </div>
          
          {error && (
            <div className="mb-3 max-w-full overflow-hidden">
              <div className="text-red-600 text-xs font-mono bg-red-100 p-2 rounded border max-h-20 overflow-y-auto">
                {error.message}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 mt-2">
            <button
              onClick={this.handleRetry}
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
            >
              🔄 Retry
            </button>
            
            <button
              onClick={this.handleReportError}
              className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
            >
              📋 Report
            </button>
          </div>
          
          <div className="mt-2 text-gray-400 text-xs">
            Widget ID: {widgetId.slice(-8)}
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default WidgetErrorBoundary;