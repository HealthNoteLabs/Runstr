import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  connectWallet, 
  softDisconnectWallet, 
  checkWalletConnection as checkWalletConnectionService,
  getWalletAPI,
  subscribeToConnectionChanges,
  CONNECTION_STATES
} from '../services/wallet/WalletPersistenceService';

const NWCWalletContext = createContext();

export const NWCWalletProvider = ({ children }) => {
  // State that matches the NIP60 interface expected by DashboardWalletHeader
  const [state, setState] = useState({
    balance: 0,
    isConnected: false,
    loading: false,
    error: null,
    isInitialized: false,
    transactions: [], // Lightning payments/invoices instead of token events
    lastTransactions: [], // Recent payments for display
    walletAPI: null
  });

  // Connection management
  const [connectionCheckInterval, setConnectionCheckInterval] = useState(null);

  // Check wallet connection and get balance
  const checkConnection = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const connectionActive = await checkWalletConnectionService();
      
      if (connectionActive) {
        const walletAPI = getWalletAPI();
        
        // Try to get balance
        let balance = 0;
        try {
          const balanceResult = await walletAPI.getBalance();
          balance = balanceResult?.balance || 0;
        } catch (balanceError) {
          console.warn('[NWCWalletContext] Could not fetch balance:', balanceError);
          // Don't treat balance fetch failure as connection failure
        }

        setState(prev => ({
          ...prev,
          isConnected: true,
          balance,
          walletAPI,
          loading: false,
          error: null,
          isInitialized: true
        }));
      } else {
        setState(prev => ({
          ...prev,
          isConnected: false,
          balance: 0,
          walletAPI: null,
          loading: false,
          isInitialized: true
        }));
      }

      return connectionActive;
    } catch (error) {
      console.error('[NWCWalletContext] Connection check failed:', error);
      setState(prev => ({
        ...prev,
        isConnected: false,
        balance: 0,
        walletAPI: null,
        loading: false,
        error: error.message,
        isInitialized: true
      }));
      return false;
    }
  }, []);

  // Refresh wallet data (equivalent to refreshWallet in NIP60)
  const refreshWallet = useCallback(async () => {
    console.log('[NWCWalletContext] Refreshing wallet data...');
    await checkConnection();
  }, [checkConnection]);

  // Connect to NWC wallet
  const connectNWC = useCallback(async (connectionString) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const connected = await connectWallet(connectionString);
      
      if (connected) {
        await checkConnection();
        return true;
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to connect to wallet'
        }));
        return false;
      }
    } catch (error) {
      console.error('[NWCWalletContext] Connection failed:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
        isConnected: false
      }));
      return false;
    }
  }, [checkConnection]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await softDisconnectWallet();
      setState(prev => ({
        ...prev,
        isConnected: false,
        balance: 0,
        walletAPI: null,
        transactions: [],
        lastTransactions: []
      }));
    } catch (error) {
      console.error('[NWCWalletContext] Disconnect failed:', error);
    }
  }, []);

  // Send Lightning payment
  const sendPayment = useCallback(async (recipient, amount, memo = '') => {
    try {
      if (!state.walletAPI) {
        throw new Error('Wallet not connected');
      }

      setState(prev => ({ ...prev, loading: true, error: null }));

      // For Lightning addresses or LNURL
      let invoice;
      if (recipient.includes('@') || recipient.toLowerCase().startsWith('lnurl')) {
        // Generate invoice for Lightning address/LNURL
        // This would need to be implemented based on your LNURL handling
        throw new Error('Lightning address payments not yet implemented');
      } else if (recipient.toLowerCase().startsWith('lnbc')) {
        // Direct invoice payment
        invoice = recipient;
      } else {
        throw new Error('Invalid recipient format. Use Lightning invoice (lnbc...) or Lightning address (user@domain.com)');
      }

      const result = await state.walletAPI.makePayment(invoice);
      
      // Refresh balance after payment
      await checkConnection();
      
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      console.error('[NWCWalletContext] Payment failed:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
      throw error;
    }
  }, [state.walletAPI, checkConnection]);

  // Generate Lightning invoice for receiving
  const generateInvoice = useCallback(async (amount, memo = '') => {
    try {
      if (!state.walletAPI) {
        throw new Error('Wallet not connected');
      }

      setState(prev => ({ ...prev, loading: true, error: null }));

      // This would need to be implemented based on your wallet's capabilities
      // Many NWC wallets don't support invoice generation
      throw new Error('Invoice generation not supported by this wallet');
    } catch (error) {
      console.error('[NWCWalletContext] Invoice generation failed:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
      throw error;
    }
  }, [state.walletAPI]);

  // Initialize connection check and subscribe to changes
  useEffect(() => {
    // Initial connection check
    checkConnection();

    // Subscribe to connection state changes
    const unsubscribe = subscribeToConnectionChanges((connectionState) => {
      console.log('[NWCWalletContext] Connection state changed:', connectionState);
      
      if (connectionState === CONNECTION_STATES.CONNECTED) {
        checkConnection();
      } else if (connectionState === CONNECTION_STATES.DISCONNECTED) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          balance: 0,
          walletAPI: null
        }));
      }
    });

    // Set up periodic balance refresh
    const interval = setInterval(() => {
      if (state.isConnected) {
        checkConnection();
      }
    }, 60000); // Check every minute

    setConnectionCheckInterval(interval);

    return () => {
      unsubscribe();
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [checkConnection, state.isConnected]);

  // Context value that matches NIP60 interface
  const contextValue = {
    // NIP60 compatibility interface
    balance: state.balance,
    hasWallet: state.isConnected, // NIP60 uses hasWallet, NWC uses isConnected
    isConnected: state.isConnected,
    loading: state.loading,
    error: state.error,
    isInitialized: state.isInitialized,
    tokenEvents: state.transactions, // NIP60 calls them tokenEvents
    transactions: state.transactions,
    lastTransactions: state.lastTransactions,
    
    // Compatibility constants (empty for Lightning)
    SUPPORTED_MINTS: [], // No mints in Lightning
    currentMint: null, // No mints in Lightning
    walletEvent: null, // No Nostr events for NWC
    mintEvent: null, // No mint events for Lightning
    
    // Functions
    refreshWallet,
    connectNWC,
    disconnect,
    sendPayment,
    generateInvoice,
    
    // Internal state for advanced usage
    walletAPI: state.walletAPI,
    checkConnection
  };

  return (
    <NWCWalletContext.Provider value={contextValue}>
      {children}
    </NWCWalletContext.Provider>
  );
};

// Hook to consume NWC wallet context (matches useNip60 interface)
export const useNWC = () => {
  const context = useContext(NWCWalletContext);
  if (!context) {
    throw new Error('useNWC must be used within a NWCWalletProvider');
  }
  return context;
};

// For backward compatibility, also export as useNip60
export const useNip60 = useNWC; 