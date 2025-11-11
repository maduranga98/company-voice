import { toast } from "react-toastify";

/**
 * Toast notification service
 * Provides consistent toast notifications across the app
 */

const defaultOptions = {
  position: "top-right",
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

/**
 * Show success toast
 * @param {string} message - Success message
 * @param {object} options - Toast options
 */
export const showSuccess = (message, options = {}) => {
  toast.success(message, {
    ...defaultOptions,
    ...options,
  });
};

/**
 * Show error toast
 * @param {string} message - Error message
 * @param {object} options - Toast options
 */
export const showError = (message, options = {}) => {
  toast.error(message, {
    ...defaultOptions,
    autoClose: 6000, // Longer for errors
    ...options,
  });
};

/**
 * Show info toast
 * @param {string} message - Info message
 * @param {object} options - Toast options
 */
export const showInfo = (message, options = {}) => {
  toast.info(message, {
    ...defaultOptions,
    ...options,
  });
};

/**
 * Show warning toast
 * @param {string} message - Warning message
 * @param {object} options - Toast options
 */
export const showWarning = (message, options = {}) => {
  toast.warning(message, {
    ...defaultOptions,
    ...options,
  });
};

/**
 * Show loading toast
 * @param {string} message - Loading message
 * @returns {string|number} - Toast ID
 */
export const showLoading = (message = "Loading...") => {
  return toast.loading(message, {
    ...defaultOptions,
    autoClose: false,
  });
};

/**
 * Update existing toast
 * @param {string|number} toastId - Toast ID to update
 * @param {object} options - Update options
 */
export const updateToast = (toastId, options) => {
  toast.update(toastId, {
    ...defaultOptions,
    ...options,
    isLoading: false,
  });
};

/**
 * Dismiss toast
 * @param {string|number} toastId - Toast ID to dismiss (optional, dismisses all if not provided)
 */
export const dismissToast = (toastId = null) => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
};

/**
 * Show promise toast (automatically handles loading, success, error)
 * @param {Promise} promise - Promise to track
 * @param {object} messages - Messages for different states
 * @returns {Promise} - Original promise
 */
export const showPromise = (promise, messages = {}) => {
  const defaultMessages = {
    pending: "Processing...",
    success: "Success!",
    error: "Something went wrong",
  };

  return toast.promise(
    promise,
    {
      pending: messages.pending || defaultMessages.pending,
      success: messages.success || defaultMessages.success,
      error: messages.error || defaultMessages.error,
    },
    defaultOptions
  );
};

/**
 * Show toast with action button
 * @param {string} message - Message to display
 * @param {string} actionLabel - Action button label
 * @param {Function} onAction - Action button callback
 * @param {string} type - Toast type (success, error, info, warning)
 */
export const showWithAction = (message, actionLabel, onAction, type = "info") => {
  const toastFn = {
    success: toast.success,
    error: toast.error,
    info: toast.info,
    warning: toast.warning,
  }[type] || toast.info;

  const ActionToast = ({ closeToast }) => (
    <div className="flex items-center justify-between gap-3">
      <span>{message}</span>
      <button
        onClick={() => {
          onAction();
          closeToast();
        }}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition"
      >
        {actionLabel}
      </button>
    </div>
  );

  toastFn(ActionToast, {
    ...defaultOptions,
    closeButton: false,
  });
};

/**
 * Show network error toast with retry option
 * @param {string} message - Error message
 * @param {Function} onRetry - Retry callback
 */
export const showNetworkError = (message, onRetry) => {
  showWithAction(
    message || "Network error. Please check your connection.",
    "Retry",
    onRetry,
    "error"
  );
};

/**
 * Show undo toast
 * @param {string} message - Message to display
 * @param {Function} onUndo - Undo callback
 * @param {number} duration - Auto-close duration in ms
 */
export const showUndo = (message, onUndo, duration = 5000) => {
  const UndoToast = ({ closeToast }) => (
    <div className="flex items-center justify-between gap-3">
      <span>{message}</span>
      <button
        onClick={() => {
          onUndo();
          closeToast();
        }}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition"
      >
        Undo
      </button>
    </div>
  );

  toast.info(UndoToast, {
    ...defaultOptions,
    autoClose: duration,
    closeButton: false,
  });
};

export default {
  showSuccess,
  showError,
  showInfo,
  showWarning,
  showLoading,
  updateToast,
  dismissToast,
  showPromise,
  showWithAction,
  showNetworkError,
  showUndo,
};
