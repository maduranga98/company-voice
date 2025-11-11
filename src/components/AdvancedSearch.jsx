/**
 * Advanced Search Component
 * Provides full-text search with advanced filters
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  advancedSearch,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
  useSavedSearch,
} from '../services/searchService';
import { Search, Filter, Save, Trash2, Clock, X } from 'lucide-react';

const AdvancedSearch = ({ onResultsChange, initialFilters = {} }) => {
  const { currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [searchInComments, setSearchInComments] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [results, setResults] = useState([]);
  const [commentResults, setCommentResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showSavedSearches, setShowSavedSearches] = useState(false);

  const isAdmin = ['super_admin', 'company_admin', 'hr'].includes(currentUser?.role);

  // Load saved searches on mount (for admins)
  useEffect(() => {
    if (isAdmin) {
      loadSavedSearches();
    }
  }, [isAdmin]);

  const loadSavedSearches = async () => {
    try {
      const searches = await getSavedSearches();
      setSavedSearches(searches);
    } catch (error) {
      console.error('Error loading saved searches:', error);
    }
  };

  const handleSearch = async (page = 1) => {
    setLoading(true);
    try {
      const result = await advancedSearch({
        query,
        searchInComments,
        filters,
        page,
        limit: 20,
      });

      setResults(result.results || []);
      setCommentResults(result.commentResults || []);
      setPagination(result.pagination);
      setCurrentPage(page);

      if (onResultsChange) {
        onResultsChange(result.results, result.commentResults);
      }
    } catch (error) {
      console.error('Error performing search:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) {
      alert('Please enter a name for this search');
      return;
    }

    try {
      await saveSearch(saveSearchName, query, filters, searchInComments);
      alert('Search saved successfully!');
      setShowSaveDialog(false);
      setSaveSearchName('');
      loadSavedSearches();
    } catch (error) {
      console.error('Error saving search:', error);
      alert('Failed to save search. Please try again.');
    }
  };

  const handleLoadSavedSearch = async (search) => {
    try {
      await useSavedSearch(search.id);
      setQuery(search.query || '');
      setFilters(search.filters || {});
      setSearchInComments(search.searchInComments || false);
      setShowSavedSearches(false);
      handleSearch();
    } catch (error) {
      console.error('Error loading saved search:', error);
    }
  };

  const handleDeleteSavedSearch = async (searchId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved search?')) return;

    try {
      await deleteSavedSearch(searchId);
      loadSavedSearches();
    } catch (error) {
      console.error('Error deleting saved search:', error);
      alert('Failed to delete search. Please try again.');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setQuery('');
    setSearchInComments(false);
  };

  const activeFilterCount = Object.values(filters).filter((v) => v !== '' && v !== null && v !== undefined).length;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search posts and comments..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-lg border ${
            showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-700'
          } hover:bg-gray-50 flex items-center gap-2`}
        >
          <Filter className="w-4 h-4" />
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setShowSavedSearches(!showSavedSearches)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Saved
            </button>

            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </>
        )}

        {(query || activeFilterCount > 0) && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Search in Comments Option */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={searchInComments}
            onChange={(e) => setSearchInComments(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Search within comments
        </label>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type || ''}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="problem_report">Problem Report</option>
              <option value="idea_suggestion">Idea Suggestion</option>
              <option value="creative_content">Creative Content</option>
              <option value="team_discussion">Team Discussion</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filters.priority || ''}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              value={filters.department || ''}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              placeholder="Department"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anonymous</label>
            <select
              value={filters.isAnonymous === undefined ? '' : filters.isAnonymous.toString()}
              onChange={(e) =>
                handleFilterChange('isAnonymous', e.target.value === '' ? undefined : e.target.value === 'true')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Posts</option>
              <option value="true">Anonymous Only</option>
              <option value="false">Named Only</option>
            </select>
          </div>
        </div>
      )}

      {/* Saved Searches Panel */}
      {showSavedSearches && savedSearches.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Saved Searches</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {savedSearches.map((search) => (
              <div
                key={search.id}
                onClick={() => handleLoadSavedSearch(search)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{search.name}</div>
                  <div className="text-xs text-gray-500">
                    {search.query && `Query: "${search.query}"`}
                    {search.useCount > 0 && ` • Used ${search.useCount} times`}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteSavedSearch(search.id, e)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save This Search</h3>
            <input
              type="text"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              placeholder="Enter search name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveSearch}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveSearchName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="border-t pt-4 mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} results)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSearch(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handleSearch(currentPage + 1)}
              disabled={!pagination.hasMore}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
