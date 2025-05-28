import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    const stored = localStorage.getItem('defaultZapAmount');
    return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
  });
  
  // Set up Amber deep linking handler
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Try to restore existing connection first
      const restored = AmberAuth.restoreConnection();
      if (restored) {
        const state = AmberAuth.getConnectionState();
        if (state.pubkey && state.isValid) {
          console.log('[NostrProvider] Restored Amber connection for pubkey:', state.pubkey);
          setPublicKey(state.pubkey);
          setIsNostrReady(true);
        }
      }
      
      // Check if Amber is installed
      AmberAuth.isAmberInstalled().then(installed => {
        setIsAmberAvailable(installed);
        console.log('[NostrProvider] Amber available:', installed);
      });
      
      // Set up deep link handler for Amber responses
      const removeListener = AmberAuth.setupDeepLinkHandling((response) => {
        if (response && response.error) {
          console.error('[NostrProvider] Amber error:', response.error);
          setConnectionError(response.error);
          
          // Handle specific errors
          if (response.error.includes('permission') || response.error.includes('denied')) {
            setPublicKey(null);
            setIsNostrReady(false);
            localStorage.removeItem('permissionsGranted');
          }
          return;
        }
        
        if (response && response.pubkey) {
          console.log('[NostrProvider] Received pubkey from Amber:', response.pubkey);
          setPublicKey(response.pubkey);
          setIsNostrReady(true);
          setConnectionError(null);
          localStorage.setItem('permissionsGranted', 'true');
        }
      });
      
      // Cleanup
      return () => {
        removeListener();
      };
    }
  }, []);

  const updateDefaultZapAmount = useCallback((amount) => {
    const numAmount = parseInt(amount, 10);
    if (!isNaN(numAmount) && numAmount > 0) {
      setDefaultZapAmount(numAmount);
      localStorage.setItem('defaultZapAmount', numAmount.toString());
    }
  }, []);

  /**
   * Request authentication using appropriate method based on platform
   */
  const requestNostrPermissions = useCallback(async () => {
    setConnectionError(null);
    
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        console.log('[NostrProvider] Requesting Amber authentication...');
        const result = await AmberAuth.requestAuthentication();
        // The actual public key will be set by the deep link handler
        return result;
      } catch (error) {
        console.error('[NostrProvider] Error requesting Amber authentication:', error);
        setConnectionError(error.message);
        
        // Handle timeout specifically
        if (error.message === 'Authentication timeout') {
          setConnectionError('Authentication timed out. Please make sure Amber is open and try again.');
        }
        
        return false;
      }
    } 
    // For web or if Amber is not available, use window.nostr
    else if (window.nostr) {
      try {
        // This will trigger the extension permission dialog
        const pubkey = await window.nostr.getPublicKey();
        setPublicKey(pubkey);
        setIsNostrReady(true);
        setConnectionError(null);
        localStorage.setItem('permissionsGranted', 'true');
        return true;
      } catch (error) {
        console.error('[NostrProvider] Error getting Nostr public key:', error);
        setConnectionError(error.message);
        return false;
      }
    } else {
      console.warn('[NostrProvider] No authentication method available');
      setConnectionError('No authentication method available. Please install Amber or a Nostr extension.');
      return false;
    }
  }, [isAmberAvailable]);

  /**
   * Sign an event using appropriate method based on platform
   */
  const signEvent = useCallback(async (event) => {
    setConnectionError(null);
    
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        const signedEvent = await AmberAuth.signEvent(event);
        if (!signedEvent) {
          throw new Error('Signing failed or was cancelled');
        }
        return signedEvent;
      } catch (error) {
        console.error('[NostrProvider] Error signing with Amber:', error);
        setConnectionError(error.message);
        
        // Handle timeout specifically
        if (error.message === 'Signing timeout') {
          setConnectionError('Signing timed out. Please make sure Amber is open and try again.');
        }
        
        throw error;
      }
    } 
    // For web or if Amber is not available, use window.nostr
    else if (window.nostr) {
      try {
        const signedEvent = await window.nostr.signEvent(event);
        return signedEvent;
      } catch (error) {
        console.error('[NostrProvider] Error signing with window.nostr:', error);
        setConnectionError(error.message);
        throw error;
      }
    } else {
      const error = new Error('No signing method available');
      setConnectionError(error.message);
      throw error;
    }
  }, [isAmberAvailable]);

  /**
   * Disconnect and reset connection
   */
  const disconnect = useCallback(() => {
    console.log('[NostrProvider] Disconnecting...');
    
    if (Platform.OS === 'android') {
      AmberAuth.resetConnection();
    }
    
    setPublicKey(null);
    setIsNostrReady(false);
    setConnectionError(null);
    localStorage.removeItem('permissionsGranted');
  }, []);

  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (permissionsGranted) {
        // For Android, we rely on the deep link handler to set the public key
        if (Platform.OS === 'android' && isAmberAvailable) {
          // Check if we have a valid connection
          const state = AmberAuth.getConnectionState();
          if (state.isValid && state.pubkey) {
            setPublicKey(state.pubkey);
            setIsNostrReady(true);
          } else {
            // Try to re-authenticate
            console.log('[NostrProvider] Stored permissions found but connection invalid, attempting re-authentication...');
            requestNostrPermissions();
          }
        } 
        // For web or if Amber is not available, use window.nostr
        else if (window.nostr) {
          try {
            const pubkey = await window.nostr.getPublicKey();
            setPublicKey(pubkey);
            setIsNostrReady(true);
          } catch (error) {
            console.error('[NostrProvider] Error getting Nostr public key:', error);
            setConnectionError(error.message);
          }
        }
      }
    };

    initNostr();
  }, [isAmberAvailable, requestNostrPermissions]);

  // Periodically check Amber connection validity
  useEffect(() => {
    if (!Platform.OS === 'android' || !publicKey) return;
    
    const checkInterval = setInterval(() => {
      const state = AmberAuth.getConnectionState();
      if (!state.isValid && isNostrReady) {
        console.log('[NostrProvider] Amber connection became invalid');
        setConnectionError('Connection to Amber lost. Please reconnect.');
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(checkInterval);
  }, [publicKey, isNostrReady]);

  return (
    <NostrContext.Provider value={{ 
      publicKey, 
      isNostrReady,
      isAmberAvailable,
      requestNostrPermissions,
      signEvent,
      disconnect,
      defaultZapAmount,
      updateDefaultZapAmount,
      connectionError
    }}>
      {children}
    </NostrContext.Provider>
  );
}

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};
