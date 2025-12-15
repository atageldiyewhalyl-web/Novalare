import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component to catch JavaScript errors anywhere in the child component tree.
 * It logs errors and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console only in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Error info:', errorInfo);
    }
    
    this.setState({ errorInfo });

    // In production, you could send this to an error reporting service
    // Example: reportErrorToService(error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      // Default error UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {/* Error Card */}
            <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-8 text-center">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>

              {/* Title */}
              <h1
                className="text-white text-2xl mb-2"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700,
                }}
              >
                Something went wrong
              </h1>

              {/* Description */}
              <p
                className="text-gray-400 mb-6"
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 500,
                }}
              >
                We encountered an unexpected error. Please try again or return to the home page.
              </p>

              {/* Error details (only in development) */}
              {isDev && this.state.error && (
                <div className="mb-6 p-4 bg-red-950/50 border border-red-500/20 rounded-lg text-left">
                  <p className="text-red-400 text-sm font-mono break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-red-300 text-xs cursor-pointer hover:text-red-200">
                        Stack trace
                      </summary>
                      <pre className="mt-2 text-red-400/70 text-xs overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  <RefreshCw className="w-4 h-4 text-white" />
                  <span
                    className="text-white"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    Try Again
                  </span>
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-gray-600 hover:border-gray-500 transition-all duration-300 hover:bg-gray-800"
                >
                  <Home className="w-4 h-4 text-gray-300" />
                  <span
                    className="text-gray-300"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    Go Home
                  </span>
                </button>
              </div>
            </div>

            {/* Subtle branding */}
            <p
              className="text-center text-gray-600 mt-6 text-sm"
              style={{
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Novalare
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * A smaller, inline error boundary for specific sections
 * Use this for non-critical parts of the UI that can fail independently
 */
interface SectionErrorBoundaryProps {
  children: ReactNode;
  sectionName?: string;
}

interface SectionErrorState {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorState> {
  public state: SectionErrorState = { hasError: false };

  static getDerivedStateFromError(): Partial<SectionErrorState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(`Error in section "${this.props.sectionName || 'Unknown'}":`, error);
      console.error('Error info:', errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 text-sm mb-3">
            {this.props.sectionName 
              ? `Failed to load ${this.props.sectionName}`
              : 'This section failed to load'
            }
          </p>
          <button
            onClick={this.handleRetry}
            className="text-sm text-purple-400 hover:text-purple-300 underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
