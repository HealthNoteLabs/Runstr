import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
// Import the NDK singleton
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton'; // Corrected import without alias
import { NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'; // Keep NDKSigner types

// Function to attach the appropriate signer TO THE SINGLETON NDK
const attachSigner = async () => {
  try {
    // Check if window object exists (for browser environment)
    if (typeof window !== 'undefined') {
      // --- Priority 1: Check for stored private key ---
      const storedPrivKey = window.localStorage.getItem('runstr_privkey');
      if (storedPrivKey) {
        console.log('NostrContext: Found private key in localStorage. Using NDKPrivateKeySigner.');
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

      // --- Priority 2: Check for NIP-07 (window.nostr) ---
      if (window.nostr) {
        console.log('NostrContext: No private key found. Using NIP-07 signer (window.nostr).');
        const nip07signer = new NDKNip07Signer();
        // Use the singleton ndk instance
        ndk.signer = nip07signer;

        try {
          console.log('NostrContext: Waiting for NIP-07 signer to be ready (may require user interaction)...');
          await ndk.signer.blockUntilReady();
          console.log('NostrContext: NIP-07 signer is ready.');

          console.log('NostrContext: Attempting to get user from NIP-07 signer...');
          const user = await nip07signer.user();
          console.log('NostrContext: NIP-07 Signer attached to singleton NDK, user pubkey:', user.pubkey);
          return user.pubkey;

        } catch (nip07Error) {
            console.error('NostrContext: Error during NIP-07 signer interaction (blockUntilReady/user):', nip07Error);
            if (nip07Error.message && (nip07Error.message.toLowerCase().includes('rejected') || nip07Error.message.toLowerCase().includes('cancelled'))) {
                console.warn('NostrContext: NIP-07 operation rejected by user.');
            } else {
                console.error('NostrContext: Potentially an issue with the NIP-07 extension or its communication.', nip07Error);
            }
            ndk.signer = undefined;
        }
      }
    }

    console.log('NostrContext: No browser signer available (localStorage key or NIP-07). Signer will be undefined for singleton NDK.');
    ndk.signer = undefined;
    return null;

  } catch (error) {
    console.error('NostrContext: Error attaching signer to singleton NDK (could be user rejection or extension issue):', error);
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
  isInitialized: false,
  relayCount: 0,
  ndkError: null,
  ndk: ndk, // Provide the singleton NDK instance
  connectSigner: () => Promise.resolve({ pubkey: null, error: 'Connect signer not implemented via context directly' }), // Placeholder
  reInitializeNostrSystem: () => Promise.resolve(), // Placeholder for re-init function
});

export const NostrProvider = ({ children }) => {
  const [publicKeyInternalState, setPublicKeyInternal] = useState(null);
  const [ndkReadyInternalState, setNdkReadyInternal] = useState(false);
  const [currentRelayCountInternalState, setCurrentRelayCountInternal] = useState(0);
  const [ndkErrorInternalState, setNdkErrorInternal] = useState(null);
  // Lightning address cached from Nostr metadata (lud16/lud06)
  const [lightningAddressInternalState, setLightningAddressInternal] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('runstr_lightning_addr') || null;
    }
    return null;
  });

  // Callback to update relay count and NDK readiness
  const updateNdkStatus = useCallback(() => {
    const connectedRelays = ndk.pool?.stats()?.connected ?? 0;
    setCurrentRelayCountInternal(connectedRelays);
    setNdkReadyInternal(connectedRelays > 0);
    if (connectedRelays === 0 && !ndkErrorInternalState) {
      // If we were previously connected and now have 0 relays, set an error or warning
      // This avoids overwriting a more specific initialization error from ndkReadyPromise
      // setNdkErrorInternal("Disconnected from all relays."); // Potentially too aggressive
    }
  }, [ndkErrorInternalState]); // Add ndkErrorInternalState to prevent stale closure issues

  const initializeNostrSystemLogic = useCallback(async (isMountedRef) => {
    console.log('>>> NostrProvider: Running initializeNostrSystemLogic <<<');
    setNdkErrorInternal(null); // Clear previous errors on new attempt
    setNdkReadyInternal(false); // Reset readiness
    
    console.log('>>> NostrProvider: Awaiting ndkReadyPromise (initial connection attempt) <<<');
    let initialNdkConnectionSuccess = false;
    try {
      console.log('[NostrProvider] About to await ndkReadyPromise from ndkSingleton.');
      initialNdkConnectionSuccess = await ndkReadyPromise;
      console.log(`[NostrProvider] ndkReadyPromise resolved. Success: ${initialNdkConnectionSuccess}`);
    } catch (err) {
      console.error("NostrProvider: Error awaiting ndkReadyPromise:", err);
      if (isMountedRef.current) {
        console.log(`[NostrProvider] Setting ndkError due to ndkReadyPromise rejection: ${err.message || 'Error awaiting NDK singleton readiness.'}`);
        setNdkErrorInternal(err.message || 'Error awaiting NDK singleton readiness.');
      }
      // updateNdkStatus will set ndkReadyInternal based on current pool count (likely 0)
    }

    if (isMountedRef.current) {
      console.log('[NostrProvider] Calling updateNdkStatus after ndkReadyPromise.');
      updateNdkStatus(); // Set initial ndkReadyInternal/relayCountInternal based on promise outcome & pool state

      if (initialNdkConnectionSuccess) {
        console.log('>>> NostrProvider: Initial NDK connection reported success. Proceeding to attach signer. <<<');
        console.log('[NostrProvider] Setting ndkErrorInternal to null because initialNdkConnectionSuccess is true.');
        setNdkErrorInternal(null); // Clear any previous generic NDK errors if initial connect was ok
      } else if (!ndkErrorInternalState) { // Only set error if a more specific one isn't already there
        console.log('[NostrProvider] initialNdkConnectionSuccess is false and ndkErrorInternal is not set. Setting NDK error.');
        setNdkErrorInternal('NDK Singleton failed to initialize or connect to relays initially.');
      }
      
      // Attempt to attach signer regardless of initial connection, as signer might be local
      ensureSignerAttached().then(signerResult => {
        if (!isMountedRef.current) return;
        const finalPubkey = signerResult?.pubkey || null;
        const signerError = signerResult?.error || null;
        if (finalPubkey) {
          setPublicKeyInternal(finalPubkey);
          if (!initialNdkConnectionSuccess && !signerError) {
            // If NDK wasn't ready but signer IS, clear NDK error if it was generic
            // setNdkErrorInternal(null); // This might be too optimistic if relays are still down
          } else if (signerError) {
              setNdkErrorInternal(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
          }
          // Fetch lightning address
          try {
            const user = ndk.getUser({ pubkey: finalPubkey });
            user.fetchProfile().then(() => {
              if (!isMountedRef.current) return;
              const profile = user.profile || {};
              const laddr = profile.lud16 || profile.lud06 || null;
              if (laddr) {
                setLightningAddressInternal(laddr);
                if (typeof window !== 'undefined') window.localStorage.setItem('runstr_lightning_addr', laddr);
              }
            }).catch(laErr => console.warn('NostrProvider: Error fetching profile for LUD:', laErr));
          } catch (laErr) {
            console.warn('NostrProvider: Error constructing user for LUD fetch:', laErr);
          }
        } else if (signerError) {
          setNdkErrorInternal(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
        }
      }).catch(err => {
          if(isMountedRef.current) setNdkErrorInternal(prevError => prevError ? `${prevError} Signer Attach Exception: ${err.message}` : `Signer Attach Exception: ${err.message}`);
      });
    }
  }, [updateNdkStatus, ndkErrorInternalState]); // Added ndkErrorInternalState dependency

  useEffect(() => {
    console.log('>>> NostrProvider useEffect START (using NDK Singleton) <<<');
    const isMounted = { current: true }; // Use a ref-like object for isMounted check

    initializeNostrSystemLogic(isMounted);

    // Listeners for relay pool changes to dynamically update status
    if (ndk && ndk.pool) {
      ndk.pool.on('relay:connect', updateNdkStatus);
      ndk.pool.on('relay:disconnect', updateNdkStatus);
    }
    
    return () => {
      console.log('NostrProvider: Unmounting...');
      isMounted.current = false;
      if (ndk && ndk.pool) {
        ndk.pool.off('relay:connect', updateNdkStatus);
        ndk.pool.off('relay:disconnect', updateNdkStatus);
      }
      signerAttachmentPromise = null; // Reset signer promise on unmount
    };

  }, [updateNdkStatus, ndkErrorInternalState]); // Added ndkErrorInternalState

  // Function to allow components to trigger signer connection/re-check
  const connectSignerCb = useCallback(async () => {
    console.log("NostrContext: connectSignerCb (manual trigger) called.");
    signerAttachmentPromise = null; // Reset to allow re-attempt
    const signerResult = await ensureSignerAttached();
    const finalPubkey = signerResult?.pubkey || null;
    const signerError = signerResult?.error || null;
    if (finalPubkey) {
        setPublicKeyInternal(finalPubkey);
        setNdkErrorInternal(prev => prev && prev.startsWith("Signer:") ? null : (prev && prev.includes("Signer:") ? prev.split("Signer:")[0].trim() : prev));
    } else if (signerError) {
        setNdkErrorInternal(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
    }
    return signerResult;
  }, []);

  const setPublicKeyCb = useCallback((pk) => {
    // This function is primarily for logout or manual key changes, not initial connection.
    setPublicKeyInternal(pk);
    if (!pk && typeof window !== 'undefined') {
        window.localStorage.removeItem('runstr_privkey');
        window.localStorage.removeItem('runstr_lightning_addr');
        ndk.signer = undefined; // Clear signer on explicit logout
        signerAttachmentPromise = null; // Allow re-attachment
        setLightningAddressInternal(null);
    }
  }, []);

  const reInitializeNostrSystemCb = useCallback(() => {
    console.log(">>> NostrProvider: reInitializeNostrSystemCb called manually. <<<");
    // We need to pass a mutable isMounted check object here as well, similar to useEffect.
    // However, since this is a direct call, we can assume it's "mounted" in the sense of being actively invoked.
    // For simplicity in this callback, we'll pass a simple object. A more robust way might involve a ref if this cb were part of a component.
    initializeNostrSystemLogic({ current: true });
  }, [initializeNostrSystemLogic]);

  const value = useMemo(() => ({
    publicKey: publicKeyInternalState,
    lightningAddress: lightningAddressInternalState,
    setPublicKey: setPublicKeyCb,
    ndkReady: ndkReadyInternalState, 
    isInitialized: ndkReadyInternalState, 
    relayCount: currentRelayCountInternalState,
    ndkError: ndkErrorInternalState,
    ndk, 
    connectSigner: connectSignerCb,
    reInitializeNostrSystem: reInitializeNostrSystemCb,
  }), [
    publicKeyInternalState, 
    lightningAddressInternalState, 
    setPublicKeyCb, 
    ndkReadyInternalState, 
    currentRelayCountInternalState, 
    ndkErrorInternalState, 
    connectSignerCb,
    reInitializeNostrSystemCb
  ]);

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
};

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
