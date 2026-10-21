import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * ErrorBoundary isolates rendering crashes in a subtree (e.g. the heavy
 * Swagger UI sandbox) so the rest of the portal keeps working. Hook into a
 * telemetry provider (Sentry/Datadog) inside componentDidCatch if desired.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI error boundary caught:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center">
          <div className="inline-flex flex-col items-center gap-3 max-w-md">
            <svg
              className="w-10 h-10 text-rose-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 break-words">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** LoadingFallback is the shared suspense placeholder for lazy-loaded chunks. */
export const LoadingFallback: React.FC = () => (
  <div className="p-10 flex flex-col items-center gap-3 text-slate-400">
    <div
      className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin"
      role="status"
      aria-label="Loading"
    />
    <p className="text-sm">Loading…</p>
  </div>
);
