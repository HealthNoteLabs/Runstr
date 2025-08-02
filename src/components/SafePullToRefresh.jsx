import { useState } from 'react';
import PullToRefresh from 'react-simple-pull-to-refresh';

/**
 * SafePullToRefresh - Ultra-safe wrapper for pull-to-refresh functionality
 * 
 * This component is designed to be completely non-invasive and easily removable.
 * It wraps existing content without modifying any existing behavior.
 * 
 * Safety features:
 * - Pure wrapper pattern - no modifications to children
 * - Graceful fallbacks - if refresh fails, app continues normally
 * - Optional refresh function - defaults to no-op
 * - Custom styling to match app theme
 */
const SafePullToRefresh = ({ 
  children, 
  onRefresh,
  disabled = false,
  refreshingContent = (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-2"></div>
      <p className="text-white text-sm">Refreshing...</p>
    </div>
  )
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (disabled || isRefreshing) {
      return Promise.resolve();
    }

    setIsRefreshing(true);
    
    try {
      // Call the provided refresh function or default to no-op
      if (onRefresh && typeof onRefresh === 'function') {
        await onRefresh();
      } else {
        // No-op refresh - just show feedback and complete
        console.log('SafePullToRefresh: Refresh triggered (no action configured)');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      }
    } catch (error) {
      // Catch any refresh errors and log them without breaking the app
      console.warn('SafePullToRefresh: Refresh error (app continues normally):', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // If disabled, just return children without pull-to-refresh wrapper
  if (disabled) {
    return children;
  }

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      refreshingContent={refreshingContent}
      pullingContent=""
      className="pull-to-refresh-container"
      style={{
        // Match app's theme
        backgroundColor: 'transparent',
        color: '#ffffff',
      }}
      // Pull-to-refresh configuration
      resistance={2}
      distanceToRefresh={60}
      forceRefresh={false}
    >
      {children}
    </PullToRefresh>
  );
};

export default SafePullToRefresh;