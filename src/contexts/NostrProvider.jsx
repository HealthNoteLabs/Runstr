import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    const stored = localStorage.getItem('defaultZapAmount');
    return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
  });

  const updateDefaultZapAmount = useCallback((amount) => {
    const numAmount = parseInt(amount, 10);
    if (!isNaN(numAmount) && numAmount > 0) {
      setDefaultZapAmount(numAmount);
      localStorage.setItem('defaultZapAmount', numAmount.toString());
    }
  }, []);

  const requestNostrPermissions = useCallback(async () => {
    // If window.nostr exists, request permissions
    if (window.nostr) {
      try {
        // This will trigger the Amber Signer permission dialog
        const pubkey = await window.nostr.getPublicKey();
        setPublicKey(pubkey);
        setIsNostrReady(true);
        return true;
      } catch (error) {
        console.error('Error getting Nostr public key:', error);
        return false;
      }
    } else {
      console.warn('Nostr extension not found');
      return false;
    }
  }, []);

  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (window.nostr && permissionsGranted) {
        try {
          const pubkey = await window.nostr.getPublicKey();
          setPublicKey(pubkey);
          setIsNostrReady(true);
        } catch (error) {
          console.error('Error getting Nostr public key:', error);
        }
      }
    };

    initNostr();
  }, []);

  return (
    <NostrContext.Provider value={{ 
      publicKey, 
      isNostrReady,
      requestNostrPermissions,
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
