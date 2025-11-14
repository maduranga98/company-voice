import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown } from 'lucide-react';
import { ErrorBoundary as SentryErrorBoundary } from '../services/errorTrackingService';

/**
 * Reusable error fallback UI component
 */
export const ErrorFallback = ({ error, resetError, variant = 'full' }) => {
  const [showDetails, setShowDetails] = React.useState(false);

  if (variant === 'inline') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 mb-1">
              Something went wrong
            </h3>
            <p className="text-sm text-red-700 mb-3">
              {error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={resetError}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Unable to load content
        </h3>
        <p className="text-sm text-gray-600 text-center mb-4 max-w-sm">
          We encountered an error while loading this section. Please try again.
        </p>
        <button
          onClick={resetError}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  // Full page variant (default)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>

        <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">
          Something went wrong
        </h2>

        <p className="text-sm text-gray-600 text-center mb-6">
          We're sorry for the inconvenience. Please try refreshing the page.
        </p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={resetError}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        </div>

        {error && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition w-full"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              Error details
            </button>

            {showDetails && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-1">Error message:</p>
                <pre className="text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
                {error.stack && (
                  <>
                    <p className="text-xs font-medium text-gray-700 mb-1 mt-2">Stack trace:</p>
                    <pre className="text-xs text-gray-500 overflow-auto max-h-32 whitespace-pre-wrap break-words">
                      {error.stack}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Component-level error boundary wrapper
 * Use this to wrap individual sections/features that might fail independently
 */
export const ComponentErrorBoundary = ({
  children,
  variant = 'compact',
  fallback = null
}) => {
  return (
    <SentryErrorBoundary
      fallback={({ error, resetError }) =>
        fallback || <ErrorFallback error={error} resetError={resetError} variant={variant} />
      }
    >
      {children}
    </SentryErrorBoundary>
  );
};

/**
 * Hook to use error boundary manually
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const handleError = React.useCallback((error) => {
    console.error('Error caught:', error);
    setError(error);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    resetError,
    ErrorDisplay: error ? (
      <ErrorFallback error={error} resetError={resetError} variant="inline" />
    ) : null
  };
};

export default ErrorFallback;
