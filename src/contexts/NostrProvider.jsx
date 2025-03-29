import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    const stored = localStorage.getItem('defaultZapAmount');
    return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
  });
  
  // Set up Amber deep linking handler
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Check if Amber is installed
      AmberAuth.isAmberInstalled().then(installed => {
        setIsAmberAvailable(installed);
      });
      
      // Set up deep link handler for Amber responses
      const removeListener = AmberAuth.setupDeepLinkHandling((response) => {
        if (response && response.pubkey) {
          setPublicKey(response.pubkey);
          setIsNostrReady(true);
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
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        const result = await AmberAuth.requestAuthentication();
        // The actual public key will be set by the deep link handler
        return result;
      } catch (error) {
        console.error('Error requesting Amber authentication:', error);
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
        localStorage.setItem('permissionsGranted', 'true');
        return true;
      } catch (error) {
        console.error('Error getting Nostr public key:', error);
        return false;
      }
    } else {
      console.warn('No authentication method available');
      return false;
    }
  }, [isAmberAvailable]);

  /**
   * Sign an event using appropriate method based on platform
   */
  const signEvent = useCallback(async (event) => {
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      return AmberAuth.signEvent(event);
    } 
    // For web or if Amber is not available, use window.nostr
    else if (window.nostr) {
      return window.nostr.signEvent(event);
    } else {
      throw new Error('No signing method available');
    }
  }, [isAmberAvailable]);

  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (permissionsGranted) {
        // For Android, we rely on the deep link handler to set the public key
        if (Platform.OS === 'android' && isAmberAvailable) {
          // We don't need to do anything here, as the deep link handler will handle it
          return;
        } 
        // For web or if Amber is not available, use window.nostr
        else if (window.nostr) {
          try {
            const pubkey = await window.nostr.getPublicKey();
            setPublicKey(pubkey);
            setIsNostrReady(true);
          } catch (error) {
            console.error('Error getting Nostr public key:', error);
          }
        }
      }
    };

    initNostr();
  }, [isAmberAvailable]);

  return (
    <NostrContext.Provider value={{ 
      publicKey, 
      isNostrReady,
      isAmberAvailable,
      requestNostrPermissions,
      signEvent,
      defaultZapAmount,
      updateDefaultZapAmount 
    }}>
      {children}
    </NostrContext.Provider>
  );
}

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};
