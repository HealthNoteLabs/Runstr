import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
// Import the NDK singleton
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton'; // Consistent import without extension
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'; // Restore private key signer support
import AmberAuth from '../services/AmberAuth.js';
import { Platform } from '../utils/react-native-shim.js';

// Function to attach the appropriate signer TO THE SINGLETON NDK
const attachSigner = async () => {
  try {
    // Check if window object exists (for browser environment)
    if (typeof window !== 'undefined') {
      // --- Priority 1: Check for stored private key ---
      const storedPrivKey = window.localStorage.getItem('runstr_privkey');
      if (storedPrivKey) {
        console.log('NostrContext: Found private key, using NDKPrivateKeySigner.');
        try {
          // Use the singleton ndk instance
          ndk.signer = new NDKPrivateKeySigner(storedPrivKey);
          const user = await ndk.signer.user();
          console.log('NostrContext: Private key signer attached to singleton NDK, user pubkey:', user.pubkey);
          return user.pubkey;
        } catch (pkError) {
            console.error('NostrContext: Error initializing NDKPrivateKeySigner:', pkError);
            window.localStorage.removeItem('runstr_privkey');
            ndk.signer = undefined;
        }
      }

      // --- Priority 2: Amber authentication for Android ---
      if (Platform.OS === 'android' && await AmberAuth.isAmberInstalled()) {
        console.log('NostrContext: Amber is installed. Checking for stored pubkey...');
        
        // First check if we already have a stored Amber pubkey (like we do for private key)
        const storedAmberPubkey = AmberAuth.getCurrentPublicKey();
        if (storedAmberPubkey) {
          console.log('NostrContext: Found stored Amber pubkey, using immediately without re-authentication.');
          try {
            // Create signer with the stored pubkey - no authentication needed
            ndk.signer = {
              _pubkey: storedAmberPubkey,
              user: async function() {
                return { pubkey: this._pubkey };
              },
              sign: async (event) => {
                const signedEvent = await AmberAuth.signEvent(event);
                return signedEvent.sig;
              }
            };
            console.log('NostrContext: Amber signer attached with stored pubkey:', storedAmberPubkey);
            return storedAmberPubkey; // Return immediately to set context
          } catch (error) {
            console.error('NostrContext: Error creating signer with stored pubkey:', error);
            ndk.signer = undefined;
          }
        }
        
        // Only use lazy authentication if no stored pubkey exists
        console.log('NostrContext: No stored Amber pubkey found. Setting up lazy authentication.');
        try {
          ndk.signer = {
            _pubkey: null,
            user: async function() {
              if (!this._pubkey) {
                this._pubkey = await AmberAuth.getPublicKey();
              }
              return { pubkey: this._pubkey };
            },
            sign: async (event) => {
              const signedEvent = await AmberAuth.signEvent(event);
              return signedEvent.sig;
            }
          };
          // Don't call signer.user() here - let it be lazy
          console.log('NostrContext: Amber lazy signer configured. Authentication will happen on first use.');
          return null; // No pubkey yet, will authenticate when needed
        } catch (amberError) {
          console.error('NostrContext: Error initializing AmberSigner:', amberError);
          ndk.signer = undefined;
          return null;
        }
      }
    }

    console.log('NostrContext: Amber authentication required. Signer will be undefined for singleton NDK.');
    ndk.signer = undefined;
    return null;

  } catch (error) {
    console.error('NostrContext: Error attaching signer to singleton NDK:', error);
    ndk.signer = undefined;
    return null;
  }
};

// SIMPLIFIED Function to initialize NDK connection and signer attachment
// This function is now primarily responsible for signer attachment
// NDK connection readiness is handled by the singleton's ndkReadyPromise
let signerAttachmentPromise = null;

export const ensureSignerAttached = async () => {
  if (!signerAttachmentPromise) {
    signerAttachmentPromise = (async () => {
      console.log('NostrContext: ensureSignerAttached() called.');
      try {
        // NDK connection readiness is awaited separately by the provider
        console.log('NostrContext: Attaching signer to singleton NDK...');
        const pubkey = await attachSigner(); // attachSigner now operates on the singleton ndk
        console.log(`NostrContext: attachSigner finished. Pubkey: ${pubkey}`);
        
        // Return only pubkey and potential error related to signer attachment
        return { pubkey, error: null };

      } catch (error) {
        console.error('NostrContext: Signer attachment error inside ensureSignerAttached():', error);
        return { pubkey: null, error: error.message || 'Unknown signer attachment error' };
      } finally {
        console.log('NostrContext: ensureSignerAttached() promise execution finished.');
      }
    })();
  }
  return signerAttachmentPromise;
};


// Create context with a default value structure
export const NostrContext = createContext({
  publicKey: null,
  lightningAddress: null,
  setPublicKey: () => console.warn('NostrContext not yet initialized'),
  ndkReady: false,
  signerAvailable: false,
  isInitialized: false,
  relayCount: 0,
  ndkError: null,
  ndk: ndk, // Provide the singleton NDK instance
  connectSigner: () => Promise.resolve({ pubkey: null, error: 'Connect signer not implemented via context directly' }), // Placeholder
  // New properties for Option A implementation
  canReadData: false, // True when NDK is connected (regardless of signer)
  needsSigner: false, // True when an operation requires signer but it's not available
  // Compatibility properties from old NostrProvider
  defaultZapAmount: 1000,
  updateDefaultZapAmount: () => console.warn('NostrContext not yet initialized'),
  isAmberAvailable: false,
  requestNostrPermissions: () => Promise.resolve(false),
});

export const NostrProvider = ({ children }) => {
  const [publicKey, setPublicKeyInternal] = useState(null);
  const [ndkReady, setNdkReady] = useState(false);
  const [signerAvailable, setSignerAvailable] = useState(false);
  const [currentRelayCount, setCurrentRelayCount] = useState(0);
  const [ndkError, setNdkError] = useState(null);
  // New state for Option A implementation
  const [canReadData, setCanReadData] = useState(false);
  const [needsSigner, setNeedsSigner] = useState(false);
  // Lightning address cached from Nostr metadata (lud16/lud06)
  const [lightningAddress, setLightningAddress] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('runstr_lightning_addr') || null;
    }
    return null;
  });
  
  // Add missing properties for compatibility with old NostrProvider
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('defaultZapAmount');
      return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
    }
    return 1000;
  });
  
  // Check if Amber is available (for compatibility)
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  
  useEffect(() => {
    if (Platform.OS === 'android') {
      AmberAuth.isAmberInstalled().then(installed => {
        setIsAmberAvailable(installed);
      });
    }
  }, []);

  // Callback to update relay count and NDK readiness
  const updateNdkStatus = useCallback(() => {
    const connectedRelays = ndk.pool?.stats()?.connected ?? 0;
    setCurrentRelayCount(connectedRelays);
    const isNdkReady = connectedRelays > 0;
    setNdkReady(isNdkReady);
    // Option A: canReadData is true when NDK is connected, regardless of signer
    setCanReadData(isNdkReady);
    if (connectedRelays === 0 && !ndkError) {
      // If we were previously connected and now have 0 relays, set an error or warning
      // This avoids overwriting a more specific initialization error from ndkReadyPromise
      // setNdkError("Disconnected from all relays."); // Potentially too aggressive
    }
  }, [ndkError]); // Add ndkError to prevent stale closure issues

  useEffect(() => {
    console.log('>>> NostrProvider useEffect START (using NDK Singleton) <<<');
    let isMounted = true;

    // Setup Amber deep link handler once.
    AmberAuth.setupDeepLinkHandling();

    const initializeNostrSystem = async () => {
      console.log('>>> NostrProvider: Awaiting ndkReadyPromise (initial connection attempt) <<<');
      let initialNdkConnectionSuccess = false;
      try {
        console.log('[NostrProvider] About to await ndkReadyPromise from ndkSingleton.');
        initialNdkConnectionSuccess = await ndkReadyPromise;
        console.log(`[NostrProvider] ndkReadyPromise resolved. Success: ${initialNdkConnectionSuccess}`);
      } catch (err) {
        console.error("NostrProvider: Error awaiting ndkReadyPromise:", err);
        if (isMounted) {
          console.log(`[NostrProvider] Setting ndkError due to ndkReadyPromise rejection: ${err.message || 'Error awaiting NDK singleton readiness.'}`);
          setNdkError(err.message || 'Error awaiting NDK singleton readiness.');
        }
        // updateNdkStatus will set ndkReady based on current pool count (likely 0)
      }

      if (isMounted) {
        console.log('[NostrProvider] Calling updateNdkStatus after ndkReadyPromise.');
        updateNdkStatus(); // Set initial ndkReady/relayCount based on promise outcome & pool state

        if (initialNdkConnectionSuccess) {
          console.log('>>> NostrProvider: Initial NDK connection reported success. Proceeding to attach signer. <<<');
          // Let updateNdkStatus handle setting ndkReady based on actual relay connections
          const relayCnt = ndk.pool?.stats()?.connected ?? 0;
          setCurrentRelayCount(relayCnt);
          console.log(`[NostrProvider] Initial connection success (relayCnt=${relayCnt}).`);
          setNdkError(null); // Clear any previous generic NDK errors if initial connect was ok
        } else if (!ndkError) { // Only set error if a more specific one isn't already there
          console.log('[NostrProvider] initialNdkConnectionSuccess is false and ndkError is not set. Setting NDK error.');
          setNdkError('NDK Singleton failed to initialize or connect to relays initially.');
        }
        
        // Attempt to attach signer regardless of initial connection, as signer might be local
        ensureSignerAttached().then(signerResult => {
          if (!isMounted) return;
          const finalPubkey = signerResult?.pubkey || null;
          const signerError = signerResult?.error || null;
          if (finalPubkey) {
            setPublicKeyInternal(finalPubkey);
            if (!initialNdkConnectionSuccess && !signerError) {
              // If NDK wasn't ready but signer IS, clear NDK error if it was generic
              // setNdkError(null); // This might be too optimistic if relays are still down
            } else if (signerError) {
                setNdkError(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
            }
            // Fetch lightning address
            try {
              const user = ndk.getUser({ pubkey: finalPubkey });
              user.fetchProfile().then(() => {
                if (!isMounted) return;
                const profile = user.profile || {};
                const laddr = profile.lud16 || profile.lud06 || null;
                if (laddr) {
                  setLightningAddress(laddr);
                  if (typeof window !== 'undefined') window.localStorage.setItem('runstr_lightning_addr', laddr);
                }
              }).catch(laErr => console.warn('NostrProvider: Error fetching profile for LUD:', laErr));
            } catch (laErr) {
              console.warn('NostrProvider: Error constructing user for LUD fetch:', laErr);
            }
          } else if (signerError) {
            setNdkError(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
          }

          // *** After any signer attachment attempt, update the signerAvailable state ***
          setSignerAvailable(!!ndk.signer);

        }).catch(err => {
            if(isMounted) {
              setNdkError(prevError => prevError ? `${prevError} Signer Attach Exception: ${err.message}` : `Signer Attach Exception: ${err.message}`);
              setSignerAvailable(false); // Ensure signer is marked as unavailable on error
            }
        });
      }
    };

    initializeNostrSystem();

    // Listeners for relay pool changes to dynamically update status
    if (ndk && ndk.pool) {
      ndk.pool.on('relay:connect', updateNdkStatus);
      ndk.pool.on('relay:disconnect', updateNdkStatus);
    }
    
    return () => {
      console.log('NostrProvider: Unmounting...');
      isMounted = false;
      if (ndk && ndk.pool) {
        ndk.pool.off('relay:connect', updateNdkStatus);
        ndk.pool.off('relay:disconnect', updateNdkStatus);
      }
      signerAttachmentPromise = null; // Reset signer promise on unmount
    };

  }, [updateNdkStatus, ndkError]); // Added ndkError

  // Function to allow components to trigger signer connection/re-check
  const connectSigner = useCallback(async () => {
    console.log("NostrContext: connectSigner called by component.");
    signerAttachmentPromise = null; // Reset to allow re-attempt
    setNdkError(null); // Clear previous errors
    
    try {
      // Use the new retry authentication mechanism
      const pubkey = await AmberAuth.retryAuthentication(3);
      if (pubkey) {
        setPublicKeyInternal(pubkey);
        setSignerAvailable(true);
        
        
        // Update the NDK signer
        ndk.signer = {
          _pubkey: pubkey,
          user: async function() {
            return { pubkey: this._pubkey };
          },
          sign: async (event) => {
            const signedEvent = await AmberAuth.signEvent(event);
            return signedEvent.sig;
          }
        };
        
        console.log('NostrContext: Successfully connected with Amber, pubkey:', pubkey);
        return { pubkey, error: null };
      }
    } catch (error) {
      console.error('NostrContext: connectSigner failed:', error);
      setNdkError(error.message);
      setSignerAvailable(false);
      ndk.signer = undefined;
      return { pubkey: null, error: error.message };
    }
  }, []);

  const setPublicKey = useCallback((pk) => {
    // This function is primarily for logout or manual key changes, not initial connection.
    setPublicKeyInternal(pk);
    if (!pk && typeof window !== 'undefined') {
        window.localStorage.removeItem('runstr_privkey');
        window.localStorage.removeItem('runstr_lightning_addr');
        ndk.signer = undefined; // Clear signer on explicit logout
        signerAttachmentPromise = null; // Allow re-attachment
        setLightningAddress(null);
        setSignerAvailable(false); // Update signer state on logout
    }
  }, []);

  // Add missing functions for compatibility with old NostrProvider
  const updateDefaultZapAmount = useCallback((amount) => {
    const numAmount = parseInt(amount, 10);
    if (!isNaN(numAmount) && numAmount > 0) {
      setDefaultZapAmount(numAmount);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('defaultZapAmount', numAmount.toString());
      }
    }
  }, []);

  const requestNostrPermissions = useCallback(async () => {
    // Amber-only authentication for Android
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        const pubkey = await AmberAuth.requestAuthentication();
        if (pubkey) {
          // Set the context pubkey immediately when authentication succeeds
          setPublicKeyInternal(pubkey);
          setSignerAvailable(true);
          
          // Update the NDK signer with the authenticated pubkey
          ndk.signer = {
            _pubkey: pubkey,
            user: async function() {
              return { pubkey: this._pubkey };
            },
            sign: async (event) => {
              const signedEvent = await AmberAuth.signEvent(event);
              return signedEvent.sig;
            }
          };
          
          // DEBUG: Show toast to verify context update works
          if (typeof window !== 'undefined' && window.Android?.showToast) {
            try {
              window.Android.showToast(`DEBUG: Context pubkey set: ${pubkey.substring(0, 8)}...`);
            } catch (e) {
              console.error('Toast error:', e);
            }
          }
          
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error requesting Amber authentication:', error);
        return false;
      }
    } else {
      console.warn('Amber authentication required');
      return false;
    }
  }, [isAmberAvailable]);

  const value = useMemo(() => ({
    publicKey,
    lightningAddress,
    setPublicKey,
    ndkReady, // Dynamically updated based on relay connections
    signerAvailable, // Pass the new state through the context
    isInitialized: ndkReady, // Maintained for compatibility, reflects current ndkReady
    relayCount: currentRelayCount,
    ndkError,
    ndk, // The singleton NDK instance
    connectSigner,
    // Option A: New properties for separated data/signer concerns
    canReadData, // True when NDK is connected, regardless of signer
    needsSigner, // True when an operation requires signer but it's not available
    // Compatibility properties from old NostrProvider
    defaultZapAmount,
    updateDefaultZapAmount,
    isAmberAvailable,
    requestNostrPermissions,
  }), [publicKey, lightningAddress, setPublicKey, ndkReady, signerAvailable, currentRelayCount, ndkError, connectSigner, canReadData, needsSigner, defaultZapAmount, updateDefaultZapAmount, isAmberAvailable, requestNostrPermissions]);

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
};

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
