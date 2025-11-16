/**
 * Firebase Performance Monitoring Utility
 *
 * This module provides easy-to-use wrappers for Firebase Performance Monitoring.
 * It helps track app performance, API calls, and custom metrics.
 *
 * Usage:
 * import { tracePageLoad, traceApiCall, createCustomTrace } from '@/utils/performance';
 */

import { trace as createTrace } from 'firebase/performance';
import { performance } from '@/config/firebase';

/**
 * Create and start a custom trace
 * @param {string} traceName - The name of the trace
 * @returns {object} The trace object with start(), stop(), incrementMetric(), putMetric() methods
 */
export const createCustomTrace = (traceName) => {
  if (!performance) {
    // Return a mock trace object if performance is not initialized
    return {
      start: () => {},
      stop: () => {},
      incrementMetric: () => {},
      putMetric: () => {},
      putAttribute: () => {},
    };
  }

  try {
    return createTrace(performance, traceName);
  } catch (error) {
    console.error('Error creating performance trace:', error);
    return {
      start: () => {},
      stop: () => {},
      incrementMetric: () => {},
      putMetric: () => {},
      putAttribute: () => {},
    };
  }
};

/**
 * Trace a page load with custom metrics
 * @param {string} pageName - The name of the page
 * @returns {object} The trace object
 */
export const tracePageLoad = (pageName) => {
  const trace = createCustomTrace(`page_load_${pageName}`);
  trace.start();
  return trace;
};

/**
 * Trace an API call or network request
 * @param {string} apiName - The name/endpoint of the API
 * @param {function} apiFunction - The async function to execute
 * @returns {Promise} The result of the API call
 */
export const traceApiCall = async (apiName, apiFunction) => {
  const trace = createCustomTrace(`api_${apiName}`);
  trace.start();

  const startTime = Date.now();
  let success = true;
  let statusCode = null;

  try {
    const result = await apiFunction();
    statusCode = result?.status || 200;
    return result;
  } catch (error) {
    success = false;
    statusCode = error?.response?.status || 500;
    throw error;
  } finally {
    const duration = Date.now() - startTime;

    // Add custom metrics
    trace.putMetric('response_time_ms', duration);
    trace.putMetric('success', success ? 1 : 0);
    if (statusCode) {
      trace.putMetric('status_code', statusCode);
    }

    // Add custom attributes
    trace.putAttribute('success', success.toString());
    if (statusCode) {
      trace.putAttribute('status', statusCode.toString());
    }

    trace.stop();
  }
};

/**
 * Trace a Firestore operation
 * @param {string} operation - The operation name (e.g., 'read_posts', 'write_comment')
 * @param {function} firestoreFunction - The async function to execute
 * @returns {Promise} The result of the operation
 */
export const traceFirestoreOperation = async (operation, firestoreFunction) => {
  const trace = createCustomTrace(`firestore_${operation}`);
  trace.start();

  const startTime = Date.now();
  let success = true;
  let documentCount = 0;

  try {
    const result = await firestoreFunction();

    // Try to determine document count from result
    if (result?.docs) {
      documentCount = result.docs.length;
    } else if (Array.isArray(result)) {
      documentCount = result.length;
    } else if (result?.size !== undefined) {
      documentCount = result.size;
    }

    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;

    trace.putMetric('duration_ms', duration);
    trace.putMetric('success', success ? 1 : 0);
    trace.putMetric('document_count', documentCount);
    trace.putAttribute('operation', operation);
    trace.putAttribute('success', success.toString());

    trace.stop();
  }
};

/**
 * Trace a user action with custom metrics
 * @param {string} actionName - The name of the action
 * @param {function} actionFunction - The async function to execute
 * @param {object} customMetrics - Optional custom metrics to track
 * @returns {Promise} The result of the action
 */
export const traceUserAction = async (actionName, actionFunction, customMetrics = {}) => {
  const trace = createCustomTrace(`user_action_${actionName}`);
  trace.start();

  const startTime = Date.now();
  let success = true;

  try {
    const result = await actionFunction();
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;

    trace.putMetric('duration_ms', duration);
    trace.putMetric('success', success ? 1 : 0);

    // Add any custom metrics
    Object.entries(customMetrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        trace.putMetric(key, value);
      } else {
        trace.putAttribute(key, value.toString());
      }
    });

    trace.putAttribute('action', actionName);
    trace.putAttribute('success', success.toString());

    trace.stop();
  }
};

/**
 * Trace component render performance
 * @param {string} componentName - The name of the component
 * @returns {function} A function to call when the component is done rendering
 */
export const traceComponentRender = (componentName) => {
  const trace = createCustomTrace(`component_render_${componentName}`);
  const startTime = Date.now();
  trace.start();

  return () => {
    const duration = Date.now() - startTime;
    trace.putMetric('render_time_ms', duration);
    trace.putAttribute('component', componentName);
    trace.stop();
  };
};

/**
 * Trace data processing operations
 * @param {string} operationName - The name of the operation
 * @param {function} processFunction - The function to execute
 * @param {number} itemCount - Number of items being processed
 * @returns {Promise|any} The result of the operation
 */
export const traceDataProcessing = async (operationName, processFunction, itemCount = 0) => {
  const trace = createCustomTrace(`data_processing_${operationName}`);
  trace.start();

  const startTime = Date.now();
  let success = true;

  try {
    const result = await Promise.resolve(processFunction());
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;

    trace.putMetric('duration_ms', duration);
    trace.putMetric('item_count', itemCount);
    trace.putMetric('success', success ? 1 : 0);

    if (itemCount > 0) {
      const itemsPerSecond = Math.round((itemCount / duration) * 1000);
      trace.putMetric('items_per_second', itemsPerSecond);
    }

    trace.putAttribute('operation', operationName);
    trace.putAttribute('success', success.toString());

    trace.stop();
  }
};

/**
 * Trace file upload operations
 * @param {string} fileName - The name of the file
 * @param {number} fileSize - The size of the file in bytes
 * @param {function} uploadFunction - The async function to execute
 * @returns {Promise} The result of the upload
 */
export const traceFileUpload = async (fileName, fileSize, uploadFunction) => {
  const trace = createCustomTrace('file_upload');
  trace.start();

  const startTime = Date.now();
  let success = true;

  try {
    const result = await uploadFunction();
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const uploadSpeedKBps = Math.round((fileSize / 1024) / (duration / 1000));

    trace.putMetric('duration_ms', duration);
    trace.putMetric('file_size_bytes', fileSize);
    trace.putMetric('upload_speed_kbps', uploadSpeedKBps);
    trace.putMetric('success', success ? 1 : 0);
    trace.putAttribute('file_name', fileName);
    trace.putAttribute('success', success.toString());

    trace.stop();
  }
};

/**
 * Trace authentication operations
 * @param {string} operation - The auth operation (e.g., 'login', 'signup', 'logout')
 * @param {function} authFunction - The async function to execute
 * @returns {Promise} The result of the auth operation
 */
export const traceAuthOperation = async (operation, authFunction) => {
  const trace = createCustomTrace(`auth_${operation}`);
  trace.start();

  const startTime = Date.now();
  let success = true;

  try {
    const result = await authFunction();
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;

    trace.putMetric('duration_ms', duration);
    trace.putMetric('success', success ? 1 : 0);
    trace.putAttribute('operation', operation);
    trace.putAttribute('success', success.toString());

    trace.stop();
  }
};

/**
 * Simple wrapper to time any synchronous or asynchronous operation
 * @param {string} traceName - The name of the trace
 * @param {function} fn - The function to execute (can be sync or async)
 * @returns {Promise|any} The result of the function
 */
export const timeOperation = async (traceName, fn) => {
  const trace = createCustomTrace(traceName);
  trace.start();

  try {
    const result = await Promise.resolve(fn());
    return result;
  } finally {
    trace.stop();
  }
};

// Export all performance monitoring functions
export default {
  createCustomTrace,
  tracePageLoad,
  traceApiCall,
  traceFirestoreOperation,
  traceUserAction,
  traceComponentRender,
  traceDataProcessing,
  traceFileUpload,
  traceAuthOperation,
  timeOperation,
};
