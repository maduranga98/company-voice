import React from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import usePullToRefresh from '../hooks/usePullToRefresh';

/**
 * Pull-to-refresh wrapper component for feed pages
 *
 * @param {Object} props
 * @param {Function} props.onRefresh - Function to call when refresh is triggered
 * @param {React.ReactNode} props.children - Content to render
 * @param {boolean} props.enabled - Whether pull-to-refresh is enabled (default: true)
 * @param {number} props.threshold - Distance to trigger refresh (default: 80)
 */
const PullToRefresh = ({
  onRefresh,
  children,
  enabled = true,
  threshold = 80,
  className = ''
}) => {
  const { containerRef, isRefreshing, pullDistance } = usePullToRefresh(
    onRefresh,
    { enabled, threshold }
  );

  const pullPercentage = Math.min((pullDistance / threshold) * 100, 100);
  const shouldTrigger = pullDistance >= threshold;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Pull-to-refresh indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center transition-all duration-200 pointer-events-none"
        style={{
          transform: `translateY(${Math.max(pullDistance - 60, -60)}px)`,
          opacity: Math.min(pullDistance / 40, 1),
        }}
      >
        <div className="flex flex-col items-center justify-center bg-white rounded-full shadow-lg p-3 mt-4">
          {isRefreshing ? (
            <>
              <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
              <span className="text-xs text-gray-600 mt-1">Refreshing...</span>
            </>
          ) : shouldTrigger ? (
            <>
              <ArrowDown className="h-6 w-6 text-green-600" />
              <span className="text-xs text-gray-600 mt-1">Release to refresh</span>
            </>
          ) : (
            <>
              <ArrowDown
                className="h-6 w-6 text-gray-400 transition-transform"
                style={{
                  transform: `rotate(${pullPercentage * 1.8}deg)`,
                }}
              />
              <span className="text-xs text-gray-600 mt-1">Pull to refresh</span>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {pullDistance > 0 && !isRefreshing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-200"
            style={{ width: `${pullPercentage}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className={isRefreshing ? 'opacity-75 pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );
};

/**
 * Simple refresh button for desktop/fallback
 */
export const RefreshButton = ({ onRefresh, loading = false, className = '' }) => {
  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg
        hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed transition-all ${className}`}
      aria-label="Refresh"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      <span className="text-sm font-medium text-gray-700">
        {loading ? 'Refreshing...' : 'Refresh'}
      </span>
    </button>
  );
};

export default PullToRefresh;
