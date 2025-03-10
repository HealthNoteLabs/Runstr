import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [permissionLevel, setPermissionLevel] = useState('none');

  useEffect(() => {
    const initNostr = async () => {
      if (window.nostr) {
        try {
          // On initial load, only check if we can get the public key
          // This should work with basic permissions
          const pubkey = await window.nostr.getPublicKey();
          setPublicKey(pubkey);
          setIsNostrReady(true);
          setPermissionLevel('basic');
        } catch (error) {
          console.error('Error getting Nostr public key:', error);
          setIsNostrReady(false);
        }
      }
    };

    initNostr();
  }, []);

  const requestNostrPermissions = async (requestFullPermissions = false) => {
    if (!window.nostr) {
      console.error('Nostr extension not found');
      return false;
    }

    try {
      // First step: Just request basic permissions (public key)
      const pubkey = await window.nostr.getPublicKey();
      setPublicKey(pubkey);
      setIsNostrReady(true);
      setPermissionLevel('basic');
      
      // Second step (optional): Request more permissions only if needed
      if (requestFullPermissions) {
        // We don't force this step during login - only when specific features are used
        try {
          // Create a test event to check if we have signing permission
          const testEvent = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: 'Testing permissions'
          };
          
          await window.nostr.signEvent(testEvent);
          setPermissionLevel('full');
        } catch (error) {
          console.log('Full permissions not granted yet. This is okay for basic login.', error);
          // This is expected during login - we don't need to show an error
          return true; // Still return success for the basic login
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error requesting Nostr permissions:', error);
      return false;
    }
  };

  // Helper function to request additional permissions when needed for specific features
  const requestAdditionalPermissions = async () => {
    if (permissionLevel === 'full') {
      return true; // Already have full permissions
    }
    
    try {
      return await requestNostrPermissions(true);
    } catch (error) {
      console.error('Error requesting additional permissions:', error);
      return false;
    }
  };

  return (
    <NostrContext.Provider 
      value={{ 
        publicKey, 
        isNostrReady, 
        permissionLevel,
        requestNostrPermissions,
        requestAdditionalPermissions
      }}
    >
      {children}
    </NostrContext.Provider>
  );
}

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};
