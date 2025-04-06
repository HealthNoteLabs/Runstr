import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
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
        setIsLoading(false);
        
        if (response && response.pubkey) {
          setPublicKey(response.pubkey);
          setIsNostrReady(true);
          setError(null);
          localStorage.setItem('permissionsGranted', 'true');
          localStorage.setItem('nostrPublicKey', response.pubkey); // Store pubkey for NIP29 service
        } else {
          // If response is null or doesn't have pubkey, it's an error
          setError('Failed to authenticate with Amber');
          
          // Show toast if available
          if (window.Android && window.Android.showToast) {
            window.Android.showToast('Failed to authenticate with Amber. Falling back to extension.');
          }
          
          // Try fallback to extension
          tryExtensionFallback();
        }
      });
      
      // Cleanup
      return () => {
        removeListener();
      };
    }
  }, []);

  // Try to use extension as fallback
  const tryExtensionFallback = useCallback(async () => {
    if (window.nostr) {
      try {
        const pubkey = await window.nostr.getPublicKey();
        setPublicKey(pubkey);
        setIsNostrReady(true);
        setError(null);
        localStorage.setItem('permissionsGranted', 'true');
        localStorage.setItem('nostrPublicKey', pubkey);
        return true;
      } catch (fallbackError) {
        console.error('Fallback to extension failed:', fallbackError);
        setError('Authentication failed with both Amber and extension');
        return false;
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('No Nostr extension found');
      setIsLoading(false);
      return false;
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
    setIsLoading(true);
    setError(null);
    
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        // Check if Amber is in a pending state
        if (AmberAuth.isAuthenticationPending()) {
          setError('Another authentication request is in progress');
          setIsLoading(false);
          return false;
        }
        
        // Re-check if Amber is really available (skip cache)
        const reallyAvailable = await AmberAuth.isAmberInstalled(false);
        if (!reallyAvailable) {
          setIsAmberAvailable(false);
          console.warn('Amber not actually available, falling back to extension');
          return tryExtensionFallback();
        }
        
        const result = await AmberAuth.requestAuthentication();
        
        // If result is false, the request failed immediately (e.g., app not found)
        if (!result) {
          console.warn('Amber authentication failed immediately, trying fallback');
          return tryExtensionFallback();
        }
        
        // If result is true, the authentication is pending and will be handled by the deep link handler
        // Keep loading state true until deep link handler is called
        return true;
      } catch (error) {
        console.error('Error requesting Amber authentication:', error);
        setError(`Authentication error: ${error.message}`);
        setIsLoading(false);
        
        // Try fallback to extension
        return tryExtensionFallback();
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
        localStorage.setItem('nostrPublicKey', pubkey); // Store pubkey for NIP29 service
        setIsLoading(false);
        return true;
      } catch (error) {
        console.error('Error getting Nostr public key:', error);
        setError(`Extension error: ${error.message}`);
        setIsLoading(false);
        return false;
      }
    } else {
      console.warn('No authentication method available');
      setError('No Nostr signer available');
      setIsLoading(false);
      return false;
    }
  }, [isAmberAvailable, tryExtensionFallback]);

  /**
   * Sign an event using appropriate method based on platform
   */
  const signEvent = useCallback(async (event) => {
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        // Check if we have a pending request
        if (AmberAuth.isAuthenticationPending()) {
          throw new Error('Another authentication request is in progress');
        }
        
        // Re-check if Amber is really available
        const reallyAvailable = await AmberAuth.isAmberInstalled(false);
        if (!reallyAvailable) {
          setIsAmberAvailable(false);
          // Fall through to extension
        } else {
          const result = await AmberAuth.signEvent(event);
          if (result) return result;
          // If false, fall through to extension
        }
      } catch (error) {
        console.error('Error signing with Amber:', error);
        // Fall through to extension
      }
    }
    
    // Fallback to extension
    if (window.nostr) {
      return window.nostr.signEvent(event);
    }
    
    throw new Error('No signing method available');
  }, [isAmberAvailable]);

  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (permissionsGranted) {
        setIsLoading(true);
        
        // First check if we have a stored pubkey from a previous session
        const storedPubkey = localStorage.getItem('nostrPublicKey');
        if (storedPubkey) {
          setPublicKey(storedPubkey);
          setIsNostrReady(true);
          setIsLoading(false);
          return;
        }
        
        // For Android, we rely on the deep link handler to set the public key
        if (Platform.OS === 'android' && isAmberAvailable) {
          // We don't need to do anything here, as the deep link handler will handle it
          setIsLoading(false);
          return;
        } 
        // For web or if Amber is not available, use window.nostr
        else if (window.nostr) {
          try {
            const pubkey = await window.nostr.getPublicKey();
            setPublicKey(pubkey);
            setIsNostrReady(true);
            localStorage.setItem('nostrPublicKey', pubkey); // Store it for future use
          } catch (error) {
            console.error('Error getting Nostr public key:', error);
            setError(`Extension error: ${error.message}`);
          } finally {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      }
    };

    initNostr();
  }, [isAmberAvailable]);

  // Reset error when component unmounts
  useEffect(() => {
    return () => {
      AmberAuth.resetAuthAttempts();
    };
  }, []);

  return (
    <NostrContext.Provider value={{ 
      publicKey, 
      isNostrReady,
      isAmberAvailable,
      isLoading,
      error,
      requestNostrPermissions,
      signEvent,
      defaultZapAmount,
      updateDefaultZapAmount,
      resetError: () => setError(null)
    }}>
      {children}
    </NostrContext.Provider>
  );
}

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};
