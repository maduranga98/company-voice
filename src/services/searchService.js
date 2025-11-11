/**
 * Search Service
 * Frontend service for advanced search functionality
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

/**
 * Perform advanced search
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {boolean} params.searchInComments - Whether to search in comments
 * @param {Object} params.filters - Search filters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Results per page
 * @param {string} params.sortBy - Sort field
 * @param {string} params.sortOrder - Sort order (asc/desc)
 * @returns {Promise<Object>} Search results
 */
export const advancedSearch = async ({
  query = '',
  searchInComments = false,
  filters = {},
  page = 1,
  limit = 20,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}) => {
  try {
    const searchFunction = httpsCallable(functions, 'advancedSearch');
    const result = await searchFunction({
      query,
      searchInComments,
      filters,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return result.data;
  } catch (error) {
    console.error('Error in advancedSearch:', error);
    throw error;
  }
};

/**
 * Save a search
 * @param {string} name - Search name
 * @param {string} query - Search query
 * @param {Object} filters - Search filters
 * @param {boolean} searchInComments - Whether search includes comments
 * @returns {Promise<Object>} Result
 */
export const saveSearch = async (name, query, filters, searchInComments) => {
  try {
    const saveSearchFunction = httpsCallable(functions, 'saveSearch');
    const result = await saveSearchFunction({
      name,
      query,
      filters,
      searchInComments,
    });

    return result.data;
  } catch (error) {
    console.error('Error in saveSearch:', error);
    throw error;
  }
};

/**
 * Get saved searches
 * @returns {Promise<Array>} Saved searches
 */
export const getSavedSearches = async () => {
  try {
    const getSavedSearchesFunction = httpsCallable(functions, 'getSavedSearches');
    const result = await getSavedSearchesFunction();

    return result.data.searches || [];
  } catch (error) {
    console.error('Error in getSavedSearches:', error);
    throw error;
  }
};

/**
 * Delete a saved search
 * @param {string} searchId - Search ID
 * @returns {Promise<Object>} Result
 */
export const deleteSavedSearch = async (searchId) => {
  try {
    const deleteSavedSearchFunction = httpsCallable(functions, 'deleteSavedSearch');
    const result = await deleteSavedSearchFunction({ searchId });

    return result.data;
  } catch (error) {
    console.error('Error in deleteSavedSearch:', error);
    throw error;
  }
};

/**
 * Mark saved search as used (updates lastUsed timestamp)
 * @param {string} searchId - Search ID
 * @returns {Promise<Object>} Result
 */
export const useSavedSearch = async (searchId) => {
  try {
    const useSavedSearchFunction = httpsCallable(functions, 'useSavedSearch');
    const result = await useSavedSearchFunction({ searchId });

    return result.data;
  } catch (error) {
    console.error('Error in useSavedSearch:', error);
    throw error;
  }
};

/**
 * Get search analytics (admin only)
 * @param {Object} params - Parameters
 * @param {Date} params.startDate - Start date
 * @param {Date} params.endDate - End date
 * @param {number} params.limit - Max results
 * @returns {Promise<Object>} Analytics data
 */
export const getSearchAnalytics = async ({ startDate, endDate, limit = 100 }) => {
  try {
    const getSearchAnalyticsFunction = httpsCallable(functions, 'getSearchAnalytics');
    const result = await getSearchAnalyticsFunction({
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      limit,
    });

    return result.data;
  } catch (error) {
    console.error('Error in getSearchAnalytics:', error);
    throw error;
  }
};
