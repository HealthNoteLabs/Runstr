import { useNDKWallet } from '../contexts/NDKWalletContext';

// Define connection states for backward compatibility
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting', 
  CONNECTED: 'connected',
  ERROR: 'error'
};

/**
 * Hook to access wallet functionality from the NDK WalletContext
 * @returns {Object} Wallet context values and utility functions
 */
export const useWallet = () => {
  const context = useNDKWallet();
  
  if (!context) {
    throw new Error('useWallet must be used within an NDKWalletProvider');
  }
  
  // Map NDK wallet status to connection states
  const connectionState = context.status === 'ready' ? CONNECTION_STATES.CONNECTED :
                         context.status === 'loading' ? CONNECTION_STATES.CONNECTING :
                         context.status === 'failed' ? CONNECTION_STATES.ERROR :
                         CONNECTION_STATES.DISCONNECTED;
  
  // Derived computed properties
  const isConnected = connectionState === CONNECTION_STATES.CONNECTED;
  const isConnecting = connectionState === CONNECTION_STATES.CONNECTING;
  const isDisconnected = connectionState === CONNECTION_STATES.DISCONNECTED;
  const hasError = connectionState === CONNECTION_STATES.ERROR;
  
  return {
    ...context,
    // Add computed properties for backward compatibility
    connectionState,
    isConnected,
    isConnecting,
    isDisconnected,
    hasError,
    CONNECTION_STATES,
    
    // Map methods for backward compatibility
    wallet: context.wallet,
    ensureConnected: () => isConnected
  };
};

export default useWallet; 