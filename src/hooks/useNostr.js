import { useContext, useEffect, useState, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext.jsx';
import { NDKStatusManager } from '../lib/NDKStatusManager';
import { CancellableNDKRequest, SafeNDKOperations } from '../lib/CancellableNDKRequest';

/**
 * Enhanced hook to access Nostr with automatic request management
 * @returns {Object} The Nostr context values plus enhanced operations
 */
export function useNostr() {
  const context = useContext(NostrContext);
  const [requestManager] = useState(() => new CancellableNDKRequest());
  const [safeOperations, setSafeOperations] = useState(null);
  const [ndkStatus, setNdkStatus] = useState(null);

  // Initialize NDK status manager and safe operations
  useEffect(() => {
    if (context.ndk) {
      const statusManager = NDKStatusManager.getInstance(context.ndk);
      
      // Subscribe to status updates
      const unsubscribe = statusManager.subscribe(setNdkStatus);
      
      // Initialize safe operations
      setSafeOperations(new SafeNDKOperations(context.ndk, requestManager));
      
      return () => {
        unsubscribe();
      };
    }
  }, [context.ndk, requestManager]);

  // Cancel all requests when component unmounts
  useEffect(() => {
    return () => {
      requestManager.cancel();
    };
  }, [requestManager]);

  // Enhanced fetch function with automatic cancellation and timeout
  const fetchWithTimeout = useCallback(async (operation, timeoutMs = 10000) => {
    if (!safeOperations) {
      throw new Error('NDK operations not initialized');
    }
    
    return requestManager.executeWithTimeout(operation, context.ndk, timeoutMs);
  }, [safeOperations, requestManager, context.ndk]);

  // Cancel all in-flight requests
  const cancelAllRequests = useCallback(() => {
    requestManager.cancel();
  }, [requestManager]);

  // Ensure NDK connection with timeout
  const ensureConnection = useCallback(async (timeoutMs = 15000) => {
    if (context.ndk && ndkStatus) {
      const statusManager = NDKStatusManager.getInstance(context.ndk);
      return statusManager.ensureConnection(timeoutMs);
    }
    return false;
  }, [context.ndk, ndkStatus]);

  return {
    ...context,
    // Enhanced status from NDKStatusManager
    ndkStatus,
    // Enhanced operations
    safeOperations,
    fetchWithTimeout,
    cancelAllRequests,
    ensureConnection,
    // Request state
    hasActiveRequests: requestManager.isRequestActive(),
  };
}

export default useNostr; 