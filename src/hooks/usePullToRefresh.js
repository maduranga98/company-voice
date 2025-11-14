import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to add pull-to-refresh functionality to any scrollable container
 *
 * @param {Function} onRefresh - Function to call when refresh is triggered
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Distance in pixels to trigger refresh (default: 80)
 * @param {boolean} options.enabled - Whether pull-to-refresh is enabled (default: true)
 * @param {string} options.resistance - How much resistance to pulling (default: 2.5)
 *
 * @returns {Object} - Object containing ref and isRefreshing state
 */
const usePullToRefresh = (onRefresh, options = {}) => {
  const {
    threshold = 80,
    enabled = true,
    resistance = 2.5,
  } = options;

  const containerRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (!enabled || isRefreshing) return;

    // Only start if we're at the top of the scroll container
    const scrollTop = containerRef.current?.scrollTop || window.pageYOffset;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current || !enabled || isRefreshing) return;

    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;

    // Only pull down
    if (distance > 0) {
      // Apply resistance to make it feel natural
      const adjustedDistance = distance / resistance;
      setPullDistance(adjustedDistance);

      // Prevent default scrolling when pulling
      if (adjustedDistance > 10) {
        e.preventDefault();
      }
    }
  }, [enabled, isRefreshing, resistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current || !enabled) return;

    isDragging.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);

      try {
        await onRefresh();
      } catch (error) {
        console.error('Pull-to-refresh error:', error);
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // Animate back to 0
      setPullDistance(0);
    }

    startY.current = 0;
    currentY.current = 0;
  }, [pullDistance, threshold, onRefresh, enabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add touch event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    isRefreshing,
    pullDistance,
  };
};

export default usePullToRefresh;
