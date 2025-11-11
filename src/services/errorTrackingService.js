import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry error tracking
 * Call this in main.jsx or App.jsx
 */
export const initializeErrorTracking = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENVIRONMENT || "development";

  if (!dsn) {
    console.warn("Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Error filtering
    beforeSend(event, hint) {
      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error && error.message) {
        // Ignore network errors that are retryable
        if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("Load failed")
        ) {
          return null;
        }
      }
      return event;
    },
  });
};

/**
 * Set user context for Sentry
 * @param {object} user - User object
 */
export const setUserContext = (user) => {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id || user.uid,
    email: user.email,
    username: user.displayName || user.username,
    role: user.role,
    companyId: user.companyId,
  });
};

/**
 * Log an error to Sentry
 * @param {Error} error - Error object
 * @param {object} context - Additional context
 */
export const logError = (error, context = {}) => {
  console.error("Error:", error, context);

  Sentry.captureException(error, {
    extra: context,
  });
};

/**
 * Log a message to Sentry
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warning, error)
 * @param {object} context - Additional context
 */
export const logMessage = (message, level = "info", context = {}) => {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
};

/**
 * Add breadcrumb for debugging
 * @param {string} message - Breadcrumb message
 * @param {string} category - Breadcrumb category
 * @param {object} data - Additional data
 */
export const addBreadcrumb = (message, category = "custom", data = {}) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
};

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} operationName - Name of the operation for context
 * @returns {Function} - Wrapped function
 */
export const wrapAsyncFunction = (fn, operationName) => {
  return async (...args) => {
    try {
      addBreadcrumb(`Starting ${operationName}`, "operation");
      const result = await fn(...args);
      addBreadcrumb(`Completed ${operationName}`, "operation", { success: true });
      return result;
    } catch (error) {
      logError(error, {
        operation: operationName,
        arguments: args,
      });
      throw error;
    }
  };
};

/**
 * Monitor function performance
 * @param {string} name - Transaction name
 * @param {Function} fn - Function to monitor
 * @returns {Promise<any>} - Function result
 */
export const monitorPerformance = async (name, fn) => {
  const transaction = Sentry.startTransaction({
    op: "function",
    name,
  });

  try {
    const result = await fn();
    transaction.setStatus("ok");
    return result;
  } catch (error) {
    transaction.setStatus("internal_error");
    throw error;
  } finally {
    transaction.finish();
  }
};

/**
 * Handle network errors with retry logic
 * @param {Function} fn - Function to execute
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<any>} - Function result
 */
export const handleNetworkError = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      addBreadcrumb(`Network operation attempt ${attempt}`, "network");
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if it's a network error
      const isNetworkError =
        error.message?.includes("network") ||
        error.message?.includes("fetch") ||
        error.code === "unavailable" ||
        error.code === "failed-precondition";

      if (!isNetworkError || attempt === maxRetries) {
        logError(error, {
          operation: "network-operation",
          attempt,
          maxRetries,
        });
        throw error;
      }

      // Wait before retrying (exponential backoff)
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
};

/**
 * Create error boundary fallback component props
 * @param {Error} error - Error object
 * @param {Function} resetError - Function to reset error state
 * @returns {object} - Props for error fallback component
 */
export const getErrorFallbackProps = (error, resetError) => {
  logError(error, { component: "ErrorBoundary" });

  return {
    error,
    resetError,
    message: getUserFriendlyErrorMessage(error),
  };
};

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @returns {string} - User-friendly message
 */
export const getUserFriendlyErrorMessage = (error) => {
  if (!error) return "An unexpected error occurred";

  const message = error.message || "";

  // Network errors
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("Failed to fetch")
  ) {
    return "Network connection error. Please check your internet connection and try again.";
  }

  // Authentication errors
  if (
    message.includes("authentication") ||
    message.includes("permission") ||
    error.code === "permission-denied"
  ) {
    return "You don't have permission to perform this action. Please contact your administrator.";
  }

  // Firestore errors
  if (error.code === "unavailable") {
    return "Service temporarily unavailable. Please try again in a moment.";
  }

  if (error.code === "not-found") {
    return "The requested item could not be found.";
  }

  if (error.code === "already-exists") {
    return "This item already exists.";
  }

  // Rate limiting
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many requests. Please wait a moment before trying again.";
  }

  // Generic error
  return "An unexpected error occurred. Please try again.";
};

/**
 * Error boundary component wrapper
 * Use this to wrap your entire app or specific components
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

export default {
  initializeErrorTracking,
  setUserContext,
  logError,
  logMessage,
  addBreadcrumb,
  wrapAsyncFunction,
  monitorPerformance,
  handleNetworkError,
  getErrorFallbackProps,
  getUserFriendlyErrorMessage,
  ErrorBoundary,
};
