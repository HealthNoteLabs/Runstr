/**
 * WalletPersistenceService
 * 
 * Manages wallet connection persistence independent of React component lifecycle.
 * This service maintains the wallet connection in the background.
 */

import { AlbyWallet } from '../albyWallet';

// Singleton instance of the wallet
let walletInstance = null;
let connectionState = 'disconnected';
let connectionObservers = [];
let connectionCheckInterval = null;

// Connection state constants
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

/**
 * Initialize the wallet service and reconnect if credentials exist
 */
export const initWalletService = async () => {
  // If we already have an instance, return it
  if (walletInstance && connectionState === CONNECTION_STATES.CONNECTED) {
    return walletInstance;
  }
  
  // Create a new wallet instance if needed
  if (!walletInstance) {
    console.log('[WalletPersistenceService] Creating new AlbyWallet instance');
    walletInstance = new AlbyWallet();
  }
  
  // Try to reconnect using saved credentials
  const savedAuthUrl = localStorage.getItem('nwcAuthUrl');
  const savedConnectionString = localStorage.getItem('nwcConnectionString');
  
  if (savedAuthUrl || savedConnectionString) {
    console.log('[WalletPersistenceService] Attempting to reconnect wallet with saved credentials');
    try {
      connectionState = CONNECTION_STATES.CONNECTING;
      notifyObservers();
      
      // Try auth URL first (more reliable)
      let connected = false;
      if (savedAuthUrl) {
        try {
          console.log('[WalletPersistenceService] Trying to connect with saved auth URL');
          connected = await walletInstance.connect(savedAuthUrl);
        } catch (authUrlError) {
          console.warn('[WalletPersistenceService] Auth URL connection failed:', authUrlError);
        }
      }
      
      // If auth URL failed or not available, try connection string
      if (!connected && savedConnectionString) {
        try {
          console.log('[WalletPersistenceService] Trying to connect with saved connection string');
          connected = await walletInstance.connect(savedConnectionString);
        } catch (connStringError) {
          console.warn('[WalletPersistenceService] Connection string connection failed:', connStringError);
        }
      }
      
      if (connected) {
        // Verify the connection is actually working
        const isConnected = await walletInstance.checkConnection();
        
        if (isConnected) {
          console.log('[WalletPersistenceService] Successfully reconnected wallet');
          connectionState = CONNECTION_STATES.CONNECTED;
          startConnectionMonitoring();
        } else {
          console.log('[WalletPersistenceService] Connection established but not working properly');
          connectionState = CONNECTION_STATES.DISCONNECTED;
        }
      } else {
        console.log('[WalletPersistenceService] Could not reconnect wallet');
        connectionState = CONNECTION_STATES.DISCONNECTED;
      }
      
      notifyObservers();
      return connected ? walletInstance : null;
    } catch (err) {
      console.error('[WalletPersistenceService] Failed to reconnect wallet:', err);
      connectionState = CONNECTION_STATES.ERROR;
      notifyObservers();
      return null;
    }
  }
  
  return null;
};

/**
 * Connect to wallet with URL
 */
export const connectWallet = async (url) => {
  try {
    // Create wallet instance if it doesn't exist
    if (!walletInstance) {
      walletInstance = new AlbyWallet();
    }
    
    connectionState = CONNECTION_STATES.CONNECTING;
    notifyObservers();
    
    // Connect wallet
    const success = await walletInstance.connect(url);
    
    if (success) {
      // Verify connection is working
      const isConnected = await walletInstance.checkConnection();
      
      if (isConnected) {
        connectionState = CONNECTION_STATES.CONNECTED;
        startConnectionMonitoring();
        console.log('[WalletPersistenceService] Wallet connected successfully');
      } else {
        connectionState = CONNECTION_STATES.ERROR;
        console.log('[WalletPersistenceService] Wallet connection established but not working');
        throw new Error('Wallet connection test failed');
      }
    } else {
      connectionState = CONNECTION_STATES.DISCONNECTED;
      console.log('[WalletPersistenceService] Wallet connection failed');
    }
    
    notifyObservers();
    return success;
  } catch (err) {
    console.error('[WalletPersistenceService] Error connecting wallet:', err);
    connectionState = CONNECTION_STATES.ERROR;
    notifyObservers();
    throw err;
  }
};

/**
 * Disconnect wallet but retain credentials for reconnection
 * This will not clear localStorage
 */
export const softDisconnectWallet = async () => {
  // This doesn't remove from localStorage, allowing for reconnection
  connectionState = CONNECTION_STATES.DISCONNECTED;
  notifyObservers();
  stopConnectionMonitoring();
  return true;
};

/**
 * Fully disconnect wallet and remove credentials
 */
export const hardDisconnectWallet = async () => {
  try {
    if (walletInstance) {
      // Only call disconnect on the wallet instance but don't clear localStorage
      await walletInstance.disconnect();
      // Note: We don't call the internal wallet disconnect because
      // it clears localStorage itself. We want to manage that separately.
    }
    
    connectionState = CONNECTION_STATES.DISCONNECTED;
    notifyObservers();
    stopConnectionMonitoring();
    walletInstance = null;
    
    return true;
  } catch (err) {
    console.error('[WalletPersistenceService] Error disconnecting wallet:', err);
    return false;
  }
};

/**
 * Check wallet connection status
 */
export const checkWalletConnection = async () => {
  if (!walletInstance) {
    connectionState = CONNECTION_STATES.DISCONNECTED;
    notifyObservers();
    return false;
  }
  
  try {
    const isConnected = await walletInstance.checkConnection();
    
    if (isConnected) {
      if (connectionState !== CONNECTION_STATES.CONNECTED) {
        connectionState = CONNECTION_STATES.CONNECTED;
        notifyObservers();
      }
      return true;
    } else {
      // Only attempt to reconnect if we thought we were connected
      if (connectionState === CONNECTION_STATES.CONNECTED) {
        console.log('[WalletPersistenceService] Connection lost, attempting to reconnect');
        
        // Try to reconnect
        connectionState = CONNECTION_STATES.CONNECTING;
        notifyObservers();
        
        try {
          const reconnected = await walletInstance.ensureConnected();
          connectionState = reconnected ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.DISCONNECTED;
          notifyObservers();
          return reconnected;
        } catch (reconnectErr) {
          console.error('[WalletPersistenceService] Reconnection failed:', reconnectErr);
          connectionState = CONNECTION_STATES.ERROR;
          notifyObservers();
          return false;
        }
      }
      
      connectionState = CONNECTION_STATES.DISCONNECTED;
      notifyObservers();
      return false;
    }
  } catch (err) {
    console.error('[WalletPersistenceService] Error checking wallet connection:', err);
    connectionState = CONNECTION_STATES.ERROR;
    notifyObservers();
    return false;
  }
};

/**
 * Start monitoring wallet connection in the background
 */
const startConnectionMonitoring = () => {
  // Clear any existing interval
  stopConnectionMonitoring();
  
  // Check connection every 30 seconds for better responsiveness
  connectionCheckInterval = setInterval(async () => {
    try {
      await checkWalletConnection();
    } catch (error) {
      console.error('[WalletPersistenceService] Error in connection monitoring:', error);
    }
  }, 30000); // 30 seconds
  
  // Also add window focus and visibility event listeners
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnlineStatus);
  window.addEventListener('offline', handleOfflineStatus);
};

/**
 * Stop monitoring wallet connection
 */
const stopConnectionMonitoring = () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
  
  window.removeEventListener('focus', handleWindowFocus);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnlineStatus);
  window.removeEventListener('offline', handleOfflineStatus);
};

/**
 * Handle window focus event
 */
const handleWindowFocus = () => {
  console.log('[WalletPersistenceService] Window focused, checking connection');
  // Delay check slightly to allow network to stabilize
  setTimeout(() => checkWalletConnection(), 1000);
};

/**
 * Handle visibility change event
 */
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    console.log('[WalletPersistenceService] Page visible, checking connection');
    // Delay check slightly to allow network to stabilize
    setTimeout(() => checkWalletConnection(), 1000);
  }
};

/**
 * Handle online status event
 */
const handleOnlineStatus = () => {
  console.log('[WalletPersistenceService] Network online, checking wallet connection');
  // Reset reconnect attempts when network comes back
  if (walletInstance) {
    walletInstance.reconnectAttempts = 0;
  }
  setTimeout(() => checkWalletConnection(), 2000);
};

/**
 * Handle offline status event
 */
const handleOfflineStatus = () => {
  console.log('[WalletPersistenceService] Network offline, marking wallet as disconnected');
  if (connectionState === CONNECTION_STATES.CONNECTED) {
    connectionState = CONNECTION_STATES.DISCONNECTED;
    notifyObservers();
  }
};

/**
 * Get current wallet instance
 */
export const getWalletInstance = () => {
  return walletInstance;
};

/**
 * Get current connection state
 */
export const getConnectionState = () => {
  return connectionState;
};

/**
 * Subscribe to connection state changes
 */
export const subscribeToConnectionChanges = (callback) => {
  connectionObservers.push(callback);
  // Notify immediately with current state
  callback(connectionState, walletInstance);
  
  // Return unsubscribe function
  return () => {
    connectionObservers = connectionObservers.filter(cb => cb !== callback);
  };
};

/**
 * Notify all observers of connection state changes
 */
const notifyObservers = () => {
  connectionObservers.forEach(callback => {
    try {
      callback(connectionState, walletInstance);
    } catch (err) {
      console.error('[WalletPersistenceService] Error in observer callback:', err);
    }
  });
};

// Initialize service on file load
initWalletService();

/**
 * Get a wallet API that mirrors the shape of AlbyWallet but goes through the service
 */
export const getWalletAPI = () => {
  // Only create functions for what we need to expose
  return {
    checkConnection: checkWalletConnection,
    ensureConnected: async () => {
      // First check if we're already connected
      if (connectionState === CONNECTION_STATES.CONNECTED && walletInstance) {
        const stillConnected = await checkWalletConnection();
        if (stillConnected) return true;
      }
      
      // If not connected, try to initialize/reconnect
      const instance = await initWalletService();
      if (instance && connectionState === CONNECTION_STATES.CONNECTED) {
        return true;
      }
      
      // If we have a wallet instance but it's not connected, try ensureConnected
      if (walletInstance && walletInstance.ensureConnected) {
        try {
          const reconnected = await walletInstance.ensureConnected();
          if (reconnected) {
            connectionState = CONNECTION_STATES.CONNECTED;
            notifyObservers();
            return true;
          }
        } catch (error) {
          console.error('[WalletPersistenceService] ensureConnected failed:', error);
        }
      }
      
      return false;
    },
    getBalance: async () => {
      if (!walletInstance) await initWalletService();
      if (!walletInstance) throw new Error('No wallet instance available');
      
      // Ensure connected before attempting operation
      const connected = await walletInstance.ensureConnected();
      if (!connected) throw new Error('Wallet not connected');
      
      return walletInstance.getBalance();
    },
    makePayment: async (invoice) => {
      if (!walletInstance) await initWalletService();
      if (!walletInstance) throw new Error('No wallet instance available');
      
      // Ensure connected before attempting operation
      const connected = await walletInstance.ensureConnected();
      if (!connected) throw new Error('Wallet not connected');
      
      return walletInstance.makePayment(invoice);
    },
    generateZapInvoice: async (pubkey, amount, content) => {
      if (!walletInstance) await initWalletService();
      if (!walletInstance) throw new Error('No wallet instance available');
      
      // Ensure connected before attempting operation
      const connected = await walletInstance.ensureConnected();
      if (!connected) throw new Error('Wallet not connected');
      
      return walletInstance.generateZapInvoice(pubkey, amount, content);
    },
    connect: connectWallet,
    disconnect: hardDisconnectWallet
  };
}; 