import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeNostr, fetchRunningPosts, loadSupplementaryData } from '../utils/nostr';

const NostrContext = createContext({
  publicKey: null,
  isNostrReady: false,
  defaultZapAmount: 1000,
  initializeNostr,
  fetchRunningPosts,
  loadSupplementaryData
});

export const NostrProvider = ({ children }) => {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setNostrReady] = useState(false);
  const defaultZapAmount = 1000;

  useEffect(() => {
    const initNostr = async () => {
      try {
        if (window.nostr) {
          const pubkey = await window.nostr.getPublicKey();
          setPublicKey(pubkey);
          await initializeNostr();
          setNostrReady(true);
        }
      } catch (error) {
        console.error('Error initializing Nostr:', error);
      }
    };

    initNostr();
  }, []);

  const value = {
    publicKey,
    isNostrReady,
    defaultZapAmount,
    initializeNostr,
    fetchRunningPosts,
    loadSupplementaryData
  };

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
};

export const useNostr = () => {
  const context = useContext(NostrContext);
  if (!context) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
};
