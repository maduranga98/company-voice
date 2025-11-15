import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

/**
 * HelpPanel Component
 *
 * A collapsible panel for displaying detailed help information.
 *
 * @param {string} title - Panel title
 * @param {React.ReactNode} children - Panel content
 * @param {boolean} defaultExpanded - Whether panel is expanded by default
 * @param {string} variant - Panel style: 'default', 'info', 'warning', 'success'
 */
const HelpPanel = ({
  title,
  children,
  defaultExpanded = false,
  variant = 'default'
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const variantClasses = {
    default: 'bg-gray-50 border-gray-200',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    success: 'bg-green-50 border-green-200'
  };

  const iconColors = {
    default: 'text-gray-500',
    info: 'text-blue-500',
    warning: 'text-yellow-600',
    success: 'text-green-500'
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${variantClasses[variant]}`}>
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <HelpCircle className={`w-5 h-5 ${iconColors[variant]}`} />
          <span className="font-medium text-gray-800">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-current text-gray-700">
          {children}
        </div>
      )}
    </div>
  );
};

export default HelpPanel;
