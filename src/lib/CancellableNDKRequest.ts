import NDK, { NDKSubscription } from '@nostr-dev-kit/ndk';

export class CancellableNDKRequest {
  private abortController: AbortController;
  private subscriptions: Set<NDKSubscription> = new Set();
  private isActive = true;

  constructor() {
    this.abortController = new AbortController();
  }

  /**
   * Execute an NDK operation with automatic timeout and cancellation
   */
  async executeWithTimeout<T>(
    operation: (ndk: NDK, signal: AbortSignal) => Promise<T>,
    ndk: NDK,
    timeoutMs: number = 10000
  ): Promise<T> {
    if (!this.isActive) {
      throw new Error('Request manager has been cancelled');
    }

    return Promise.race([
      // The actual operation
      operation(ndk, this.abortController.signal),
      
      // Timeout promise
      new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Request timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        
        // Clear timeout if request completes or is cancelled
        this.abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Request cancelled'));
        });
      })
    ]);
  }

  /**
   * Track an NDK subscription for automatic cleanup
   */
  trackSubscription(subscription: NDKSubscription): NDKSubscription {
    this.subscriptions.add(subscription);
    
    // Remove from tracking when subscription ends
    subscription.on('close', () => {
      this.subscriptions.delete(subscription);
    });

    return subscription;
  }

  /**
   * Cancel all in-flight requests and subscriptions
   */
  cancel(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    console.log('[NDK Request] Cancelling all requests and subscriptions');
    
    // Cancel the abort controller (cancels Promise.race operations)
    this.abortController.abort();
    
    // Stop all tracked subscriptions
    this.subscriptions.forEach(subscription => {
      try {
        subscription.stop();
      } catch (error) {
        console.warn('[NDK Request] Error stopping subscription:', error);
      }
    });
    
    this.subscriptions.clear();
  }

  /**
   * Check if this request manager is still active
   */
  isRequestActive(): boolean {
    return this.isActive && !this.abortController.signal.aborted;
  }
}

/**
 * Enhanced NDK operations with built-in cancellation and timeout
 */
export class SafeNDKOperations {
  private ndk: NDK;
  private requestManager: CancellableNDKRequest;

  constructor(ndk: NDK, requestManager: CancellableNDKRequest) {
    this.ndk = ndk;
    this.requestManager = requestManager;
  }

  /**
   * Fetch events with automatic timeout and cancellation
   */
  async fetchEvents(filter: any, options?: any, timeoutMs: number = 10000): Promise<any[]> {
    return this.requestManager.executeWithTimeout(
      async (ndk, signal) => {
        const eventsSet = await ndk.fetchEvents(filter, options);
        
        // Check if cancelled during fetch
        if (signal.aborted) {
          throw new Error('Request cancelled');
        }
        
        return Array.from(eventsSet);
      },
      this.ndk,
      timeoutMs
    );
  }

  /**
   * Subscribe to events with automatic cleanup
   */
  subscribe(filter: any, options?: any): NDKSubscription {
    const subscription = this.ndk.subscribe(filter, options);
    return this.requestManager.trackSubscription(subscription);
  }

  /**
   * Publish event with timeout
   */
  async publishEvent(event: any, timeoutMs: number = 10000): Promise<void> {
    return this.requestManager.executeWithTimeout(
      async (ndk, signal) => {
        await ndk.publish(event);
        
        if (signal.aborted) {
          throw new Error('Request cancelled');
        }
      },
      this.ndk,
      timeoutMs
    );
  }
}