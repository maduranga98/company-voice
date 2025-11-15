import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

/**
 * HelpTooltip Component
 *
 * A reusable tooltip component for providing inline help and guidance.
 *
 * @param {string} content - The help text to display
 * @param {string} title - Optional title for the tooltip
 * @param {string} position - Tooltip position: 'top', 'bottom', 'left', 'right' (default: 'top')
 * @param {string} size - Icon size: 'sm', 'md', 'lg' (default: 'md')
 */
const HelpTooltip = ({
  content,
  title,
  position = 'top',
  size = 'md'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800'
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="text-gray-400 hover:text-blue-500 transition-colors cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="Help"
      >
        <HelpCircle className={sizeClasses[size]} />
      </button>

      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} w-64 sm:w-80`}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          {/* Arrow */}
          <div
            className={`absolute ${arrowClasses[position]} w-0 h-0 border-4 border-transparent`}
          />

          {/* Tooltip Content */}
          <div className="bg-gray-800 text-white text-sm rounded-lg shadow-lg p-3">
            {title && (
              <div className="font-semibold mb-1 text-blue-300">{title}</div>
            )}
            <div className="text-gray-200">{content}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpTooltip;
