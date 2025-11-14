import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable loading spinner component with multiple size and color variants
 * @param {Object} props
 * @param {string} props.size - Size variant: 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} props.variant - Color variant: 'primary', 'white', 'gray' (default: 'primary')
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.fullScreen - Whether to show full-screen centered spinner
 * @param {string} props.text - Optional loading text to display
 */
const LoadingSpinner = ({
  size = 'md',
  variant = 'primary',
  className = '',
  fullScreen = false,
  text = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const variantClasses = {
    primary: 'text-blue-600',
    white: 'text-white',
    gray: 'text-gray-400',
    purple: 'text-purple-600',
    success: 'text-green-600',
    error: 'text-red-600'
  };

  const spinnerElement = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2
        className={`animate-spin ${sizeClasses[size]} ${variantClasses[variant]}`}
        aria-label="Loading"
      />
      {text && (
        <p className={`text-sm ${variantClasses[variant]} font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
};

/**
 * Inline loading spinner for buttons
 */
export const ButtonSpinner = ({ size = 'sm', className = '' }) => (
  <Loader2 className={`animate-spin ${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} ${className}`} />
);

/**
 * Loading overlay for content areas
 */
export const LoadingOverlay = ({ text = 'Loading...', show = true }) => {
  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg z-10">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
};

export default LoadingSpinner;
