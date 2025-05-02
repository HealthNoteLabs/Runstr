import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';
import { setAmberUserPubkey } from '../utils/nostrClient';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    const stored = localStorage.getItem('defaultZapAmount');
    return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
  });
  
  // Set up Amber deep linking handler - this is our ONLY authentication method
  useEffect(() => {
    console.log("NostrProvider: Setting up Amber deep link handler");
    
    if (Platform.OS === 'android') {
      // Check if Amber is installed
      AmberAuth.isAmberInstalled().then(installed => {
        console.log("NostrProvider: Amber installed:", installed);
        setIsAmberAvailable(installed);
      });
      
      // Set up deep link handler for Amber responses
      const removeListener = AmberAuth.setupDeepLinkHandling((response) => {
        console.log("NostrProvider: Deep link response received:", response);
        if (response && response.pubkey) {
          console.log("NostrProvider: Setting pubkey from Amber:", response.pubkey);
          setPublicKey(response.pubkey);
          setIsNostrReady(true);
          
          // Also update the pubkey in nostrClient
          setAmberUserPubkey(response.pubkey);
          
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
   * Request authentication using Amber (only method for Android)
   */
  const requestNostrPermissions = useCallback(async () => {
    // On Android, use Amber
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        console.log("NostrProvider: Requesting Amber authentication");
        const result = await AmberAuth.requestAuthentication();
        // The actual public key will be set by the deep link handler
        return result;
      } catch (error) {
        console.error('NostrProvider: Error requesting Amber authentication:', error);
        return false;
      }
    } else {
      console.warn('NostrProvider: Amber is not available for authentication');
      return false;
    }
  }, [isAmberAvailable]);

  /**
   * Sign an event using Amber (only method for Android)
   */
  const signEvent = useCallback(async (event) => {
    // For Android, use Amber
    if (Platform.OS === 'android' && isAmberAvailable) {
      console.log("NostrProvider: Signing event with Amber");
      return AmberAuth.signEvent(event);
    } else {
      throw new Error('NostrProvider: No signing method available');
    }
  }, [isAmberAvailable]);

  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (permissionsGranted && Platform.OS === 'android' && isAmberAvailable) {
        // On Android with Amber, we don't need to do anything here
        // The deep link handler will set the public key when Amber responds
        console.log("NostrProvider: Permissions already granted, waiting for Amber");
      }
    };

    initNostr();
  }, [isAmberAvailable]);

  console.log("NostrProvider rendering with publicKey:", publicKey);

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
