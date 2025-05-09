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
      
      await walletInstance.ensureConnected();
      const isConnected = await walletInstance.checkConnection();
      
      if (isConnected) {
        console.log('[WalletPersistenceService] Successfully reconnected wallet');
        connectionState = CONNECTION_STATES.CONNECTED;
        startConnectionMonitoring();
      } else {
        console.log('[WalletPersistenceService] Could not reconnect wallet');
        connectionState = CONNECTION_STATES.DISCONNECTED;
      }
      
      notifyObservers();
      return walletInstance;
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
      connectionState = CONNECTION_STATES.CONNECTED;
      startConnectionMonitoring();
      console.log('[WalletPersistenceService] Wallet connected successfully');
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
  
  // Check connection every 60 seconds
  connectionCheckInterval = setInterval(async () => {
    await checkWalletConnection();
  }, 60000);
  
  // Also add window focus and visibility event listeners
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
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
};

/**
 * Handle window focus event
 */
const handleWindowFocus = () => {
  console.log('[WalletPersistenceService] Window focused, checking connection');
  checkWalletConnection();
};

/**
 * Handle visibility change event
 */
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    console.log('[WalletPersistenceService] Page visible, checking connection');
    checkWalletConnection();
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
      if (connectionState === CONNECTION_STATES.CONNECTED) {
        const stillConnected = await checkWalletConnection();
        if (stillConnected) return true;
      }
      return initWalletService().then(instance => !!instance);
    },
    getBalance: async () => {
      if (!walletInstance) await initWalletService();
      if (!walletInstance) throw new Error('No wallet instance available');
      return walletInstance.getBalance();
    },
    makePayment: async (invoice) => {
      if (!walletInstance) await initWalletService();
      if (!walletInstance) throw new Error('No wallet instance available');
      return walletInstance.makePayment(invoice);
    },
    generateZapInvoice: async (pubkey, amount, content) => {
      if (!walletInstance) await initWalletService();
      if (!walletInstance) throw new Error('No wallet instance available');
      return walletInstance.generateZapInvoice(pubkey, amount, content);
    },
    connect: connectWallet,
    disconnect: hardDisconnectWallet
  };
}; 