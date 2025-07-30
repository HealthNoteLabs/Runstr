import NDK from '@nostr-dev-kit/ndk';

export interface NDKStatus {
  isConnected: boolean;
  canRead: boolean;
  canWrite: boolean;
  relayCount: number;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  signerState: 'none' | 'available' | 'error';
  lastError: string | null;
}

export class NDKStatusManager {
  private static instance: NDKStatusManager;
  private ndk: NDK;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private signerState: 'none' | 'available' | 'error' = 'none';
  private listeners: Set<(status: NDKStatus) => void> = new Set();
  private lastError: string | null = null;
  private retryAttempts = 0;
  private maxRetries = 5;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor(ndk: NDK) {
    this.ndk = ndk;
    this.setupEventListeners();
    this.startHealthChecks();
  }

  static getInstance(ndk: NDK): NDKStatusManager {
    if (!NDKStatusManager.instance) {
      NDKStatusManager.instance = new NDKStatusManager(ndk);
    }
    return NDKStatusManager.instance;
  }

  private setupEventListeners(): void {
    if (this.ndk.pool) {
      this.ndk.pool.on('relay:connect', () => {
        console.log('[NDK Status] Relay connected');
        this.updateConnectionState();
      });

      this.ndk.pool.on('relay:disconnect', () => {
        console.log('[NDK Status] Relay disconnected');
        this.updateConnectionState();
      });
    }
  }

  private updateConnectionState(): void {
    const connectedRelays = this.ndk.pool?.stats()?.connected || 0;
    const previousState = this.connectionState;
    
    if (connectedRelays > 0) {
      this.connectionState = 'connected';
      this.lastError = null;
      this.retryAttempts = 0;
    } else {
      this.connectionState = this.connectionState === 'connecting' ? 'connecting' : 'disconnected';
    }

    // Update signer state
    this.signerState = this.ndk.signer ? 'available' : 'none';

    // Only notify if state actually changed
    if (previousState !== this.connectionState) {
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[NDK Status] Error in listener:', error);
      }
    });
  }

  public getStatus(): NDKStatus {
    const relayCount = this.ndk.pool?.stats()?.connected || 0;
    return {
      isConnected: this.connectionState === 'connected',
      canRead: this.connectionState === 'connected',
      canWrite: this.connectionState === 'connected' && this.signerState === 'available',
      relayCount,
      connectionState: this.connectionState,
      signerState: this.signerState,
      lastError: this.lastError
    };
  }

  public async ensureConnection(timeoutMs: number = 15000): Promise<boolean> {
    if (this.connectionState === 'connected') {
      return true;
    }

    if (this.connectionState === 'connecting') {
      // Wait for current connection attempt
      return new Promise((resolve) => {
        const checkConnection = () => {
          if (this.connectionState === 'connected') {
            resolve(true);
          } else if (this.connectionState === 'error' || this.connectionState === 'disconnected') {
            resolve(false);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    return this.connectWithRetry(timeoutMs);
  }

  private async connectWithRetry(timeoutMs: number): Promise<boolean> {
    this.connectionState = 'connecting';
    this.notifyListeners();

    while (this.retryAttempts < this.maxRetries) {
      try {
        console.log(`[NDK Status] Connection attempt ${this.retryAttempts + 1}/${this.maxRetries}`);
        
        await Promise.race([
          this.ndk.connect(timeoutMs),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
          )
        ]);

        const connected = this.ndk.pool?.stats()?.connected || 0;
        if (connected > 0) {
          this.connectionState = 'connected';
          this.lastError = null;
          this.retryAttempts = 0;
          this.notifyListeners();
          return true;
        }
      } catch (error) {
        this.retryAttempts++;
        this.lastError = error.message || 'Connection failed';
        console.warn(`[NDK Status] Connection attempt ${this.retryAttempts} failed:`, error.message);
        
        if (this.retryAttempts < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(1.5, this.retryAttempts), 10000);
          console.log(`[NDK Status] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.connectionState = 'error';
    this.lastError = `Failed to connect after ${this.maxRetries} attempts`;
    this.notifyListeners();
    return false;
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      const connected = this.ndk.pool?.stats()?.connected || 0;
      if (connected === 0 && this.connectionState === 'connected') {
        console.warn('[NDK Status] Health check failed, attempting reconnection...');
        this.connectionState = 'disconnected';
        this.ensureConnection();
      }
    }, 30000); // Check every 30s
  }

  public subscribe(listener: (status: NDKStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately send current status
    listener(this.getStatus());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    this.listeners.clear();
  }
}