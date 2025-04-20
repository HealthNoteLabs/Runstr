import { useState, useEffect, useRef } from 'react';
import './PullToRefresh.css';

/**
 * A component that adds pull-to-refresh functionality to its children
 * @param {Object} props
 * @param {Function} props.onRefresh - Function to call when refresh is triggered
 * @param {ReactNode} props.children - Child components
 * @param {number} props.pullDownThreshold - Distance in pixels required to trigger refresh
 * @param {boolean} props.isRefreshing - External state indicating if refresh is in progress
 * @returns {JSX.Element}
 */
export const PullToRefresh = ({ 
  onRefresh, 
  children, 
  pullDownThreshold = 100,
  isRefreshing = false
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const refreshingRef = useRef(false);

  // Track whether we should allow pulling (only at the top of the scroll container)
  const canPullRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      // Only allow pull if we're at the top of the container
      canPullRef.current = container.scrollTop <= 0;
      if (!canPullRef.current) return;
      
      startYRef.current = e.touches[0].clientY;
      currentYRef.current = startYRef.current;
      if (!refreshingRef.current) {
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e) => {
      if (!canPullRef.current || refreshingRef.current) return;
      
      currentYRef.current = e.touches[0].clientY;
      const distance = Math.max(0, currentYRef.current - startYRef.current);
      
      // Apply resistance to the pull (gets harder the further you pull)
      const resistedDistance = Math.min(distance * 0.5, pullDownThreshold * 1.5);
      
      if (resistedDistance > 0) {
        // Prevent default scroll behavior when pulling
        e.preventDefault();
        setPullDistance(resistedDistance);
      }
    };

    const handleTouchEnd = () => {
      if (!canPullRef.current || refreshingRef.current) return;
      
      if (pullDistance >= pullDownThreshold) {
        // Trigger refresh
        onRefresh();
      }
      
      // Reset state
      setIsPulling(false);
      setPullDistance(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, pullDownThreshold, onRefresh]);

  // Calculate progress percentage for the indicator
  const progress = Math.min(1, pullDistance / pullDownThreshold);

  return (
    <div className="ptr-container" ref={containerRef}>
      <div 
        className={`ptr-indicator ${(isPulling || isRefreshing) ? 'visible' : ''} ${isRefreshing ? 'refreshing' : ''}`}
        style={{ transform: isRefreshing ? 'translateY(50px)' : `translateY(${Math.min(pullDistance, 50)}px)` }}
      >
        {isRefreshing ? (
          <div className="ptr-spinner"></div>
        ) : (
          <div className="ptr-arrow" style={{ 
            transform: progress >= 1 ? 'rotate(180deg)' : `rotate(${progress * 180}deg)` 
          }}></div>
        )}
        <span>{isRefreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>
      <div className="ptr-content">
        {children}
      </div>
    </div>
  );
}; 