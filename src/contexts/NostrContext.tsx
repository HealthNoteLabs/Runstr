import React, { createContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
// Removed PropTypes as we'll use TypeScript interfaces
// import PropTypes from 'prop-types';
import NDK, { NDKNip07Signer, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
// Import the NDK singleton
import { ndk as ndkSingleton, ndkReadyPromise } from '../lib/ndkSingleton'; // ndk is already an alias for g.__RUNSTR_NDK_INSTANCE__

// Define the shape of the context value
export interface NostrContextType {
  publicKey: string | null;
  lightningAddress: string | null;
  setPublicKey: (pk: string | null) => void;
  ndkReady: boolean;
  isInitialized: boolean; // Effectively same as ndkReady in current implementation
  relayCount: number;
  ndkError: string | null;
  ndk: NDK; // The singleton NDK instance
  connectSigner: () => Promise<{ pubkey: string | null; error: string | null }>;
  reInitializeNostrSystem: () => void;
}

// Function to attach the appropriate signer TO THE SINGLETON NDK
const attachSigner = async (): Promise<string | null> => {
  try {
    // Check if window object exists (for browser environment)
    if (typeof window !== 'undefined') {
      // --- Priority 1: Check for stored private key ---
      const storedPrivKey = window.localStorage.getItem('runstr_privkey');
      if (storedPrivKey) {
        console.log('NostrContext: Found private key in localStorage. Using NDKPrivateKeySigner.');
        try {
          // Use the singleton ndk instance
          ndkSingleton.signer = new NDKPrivateKeySigner(storedPrivKey);
          const user: NDKUser = await ndkSingleton.signer.user();
          console.log('NostrContext: Private key signer attached to singleton NDK, user pubkey:', user.pubkey);
          return user.pubkey;
        } catch (pkError: any) {
            console.error('NostrContext: Error initializing NDKPrivateKeySigner:', pkError);
            window.localStorage.removeItem('runstr_privkey');
            ndkSingleton.signer = undefined;
        }
      }

      // --- Priority 2: Check for NIP-07 (window.nostr) ---
      if ((window as any).nostr) {
        console.log('NostrContext: No private key found. Using NIP-07 signer (window.nostr).');
        const nip07signer = new NDKNip07Signer();
        // Use the singleton ndk instance
        ndkSingleton.signer = nip07signer;

        try {
          console.log('NostrContext: Waiting for NIP-07 signer to be ready (may require user interaction)...');
          await ndkSingleton.signer.blockUntilReady();
          console.log('NostrContext: NIP-07 signer is ready.');

          console.log('NostrContext: Attempting to get user from NIP-07 signer...');
          const user: NDKUser = await nip07signer.user();
          console.log('NostrContext: NIP-07 Signer attached to singleton NDK, user pubkey:', user.pubkey);
          return user.pubkey;

        } catch (nip07Error: any) {
            console.error('NostrContext: Error during NIP-07 signer interaction (blockUntilReady/user):', nip07Error);
            if (nip07Error.message && (nip07Error.message.toLowerCase().includes('rejected') || nip07Error.message.toLowerCase().includes('cancelled'))) {
                console.warn('NostrContext: NIP-07 operation rejected by user.');
            } else {
                console.error('NostrContext: Potentially an issue with the NIP-07 extension or its communication.', nip07Error);
            }
            ndkSingleton.signer = undefined;
        }
      }
    }

    console.log('NostrContext: No browser signer available (localStorage key or NIP-07). Signer will be undefined for singleton NDK.');
    ndkSingleton.signer = undefined;
    return null;

  } catch (error: any) {
    console.error('NostrContext: Error attaching signer to singleton NDK (could be user rejection or extension issue):', error);
    ndkSingleton.signer = undefined;
    return null;
  }
};

let signerAttachmentPromise: Promise<{ pubkey: string | null; error: string | null }> | null = null;

export const ensureSignerAttached = async (): Promise<{ pubkey: string | null; error: string | null }> => {
  if (!signerAttachmentPromise) {
    signerAttachmentPromise = (async () => {
      console.log('NostrContext: ensureSignerAttached() called.');
      try {
        console.log('NostrContext: Attaching signer to singleton NDK...');
        const pubkey = await attachSigner();
        console.log(`NostrContext: attachSigner finished. Pubkey: ${pubkey}`);
        return { pubkey, error: null };
      } catch (error: any) {
        console.error('NostrContext: Signer attachment error inside ensureSignerAttached():', error);
        return { pubkey: null, error: error.message || 'Unknown signer attachment error' };
      } finally {
        console.log('NostrContext: ensureSignerAttached() promise execution finished.');
      }
    })();
  }
  return signerAttachmentPromise;
};

// Create context with a default value structure that matches NostrContextType
// We cast to NostrContextType | undefined and handle the undefined case in useNostr hook.
// Or provide a full default matching the type.
export const NostrContext = createContext<NostrContextType | undefined>(undefined);

// Define Props type for NostrProvider
interface NostrProviderProps {
  children: ReactNode;
}

export const NostrProvider: React.FC<NostrProviderProps> = ({ children }) => {
  const [publicKeyInternalState, setPublicKeyInternal] = useState<string | null>(null);
  const [ndkReadyInternalState, setNdkReadyInternal] = useState<boolean>(false);
  const [currentRelayCountInternalState, setCurrentRelayCountInternal] = useState<number>(0);
  const [ndkErrorInternalState, setNdkErrorInternal] = useState<string | null>(null);
  const [lightningAddressInternalState, setLightningAddressInternal] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('runstr_lightning_addr') || null;
    }
    return null;
  });

  const updateNdkStatus = useCallback(() => {
    const connectedRelays = ndkSingleton.pool?.stats()?.connected ?? 0;
    setCurrentRelayCountInternal(connectedRelays);
    setNdkReadyInternal(connectedRelays > 0);
    if (connectedRelays === 0 && !ndkErrorInternalState) {
      // console.warn("NostrProvider: Disconnected from all relays."); // Potentially too aggressive
    }
  }, [ndkErrorInternalState]);

  const initializeNostrSystemLogic = useCallback(async (isMountedRef: { current: boolean }) => {
    console.log('>>> NostrProvider: Running initializeNostrSystemLogic <<<');
    setNdkErrorInternal(null);
    setNdkReadyInternal(false);
    
    console.log('>>> NostrProvider: Awaiting ndkReadyPromise (initial connection attempt) <<<');
    let initialNdkConnectionSuccess = false;
    try {
      console.log('[NostrProvider] About to await ndkReadyPromise from ndkSingleton.');
      initialNdkConnectionSuccess = await ndkReadyPromise; // ndkReadyPromise resolves to boolean
      console.log(`[NostrProvider] ndkReadyPromise resolved. Success: ${initialNdkConnectionSuccess}`);
    } catch (err: any) {
      console.error("NostrProvider: Error awaiting ndkReadyPromise:", err);
      if (isMountedRef.current) {
        console.log(`[NostrProvider] Setting ndkError due to ndkReadyPromise rejection: ${err.message || 'Error awaiting NDK singleton readiness.'}`);
        setNdkErrorInternal(err.message || 'Error awaiting NDK singleton readiness.');
      }
    }

    if (isMountedRef.current) {
      console.log('[NostrProvider] Calling updateNdkStatus after ndkReadyPromise.');
      updateNdkStatus();

      if (initialNdkConnectionSuccess) {
        console.log('>>> NostrProvider: Initial NDK connection reported success. Proceeding to attach signer. <<<');
        console.log('[NostrProvider] Setting ndkErrorInternal to null because initialNdkConnectionSuccess is true.');
        setNdkErrorInternal(null);
      } else if (!ndkErrorInternalState) {
        console.log('[NostrProvider] initialNdkConnectionSuccess is false and ndkErrorInternal is not set. Setting NDK error.');
        setNdkErrorInternal('NDK Singleton failed to initialize or connect to relays initially.');
      }
      
      ensureSignerAttached().then(signerResult => {
        if (!isMountedRef.current) return;
        const finalPubkey = signerResult?.pubkey || null;
        const signerError = signerResult?.error || null;
        if (finalPubkey) {
          setPublicKeyInternal(finalPubkey);
          if (signerError) {
              setNdkErrorInternal(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
          }
          try {
            const user = ndkSingleton.getUser({ pubkey: finalPubkey });
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
      }).catch((err: any) => {
          if(isMountedRef.current) setNdkErrorInternal(prevError => prevError ? `${prevError} Signer Attach Exception: ${err.message}` : `Signer Attach Exception: ${err.message}`);
      });
    }
  }, [updateNdkStatus, ndkErrorInternalState]);

  useEffect(() => {
    console.log('>>> NostrProvider useEffect START (using NDK Singleton) <<<');
    const isMounted = { current: true };

    initializeNostrSystemLogic(isMounted);

    if (ndkSingleton && ndkSingleton.pool) {
      ndkSingleton.pool.on('relay:connect', updateNdkStatus);
      ndkSingleton.pool.on('relay:disconnect', updateNdkStatus);
    }
    
    return () => {
      console.log('NostrProvider: Unmounting...');
      isMounted.current = false;
      if (ndkSingleton && ndkSingleton.pool) {
        ndkSingleton.pool.off('relay:connect', updateNdkStatus);
        ndkSingleton.pool.off('relay:disconnect', updateNdkStatus);
      }
      signerAttachmentPromise = null;
    };
  }, [initializeNostrSystemLogic, updateNdkStatus]); // initializeNostrSystemLogic is now stable due to its own dependencies

  const connectSignerCb = useCallback(async (): Promise<{ pubkey: string | null; error: string | null }> => {
    console.log("NostrContext: connectSignerCb (manual trigger) called.");
    signerAttachmentPromise = null;
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

  const setPublicKeyCb = useCallback((pk: string | null) => {
    setPublicKeyInternal(pk);
    if (!pk && typeof window !== 'undefined') {
        window.localStorage.removeItem('runstr_privkey');
        window.localStorage.removeItem('runstr_lightning_addr');
        ndkSingleton.signer = undefined;
        signerAttachmentPromise = null;
        setLightningAddressInternal(null);
    }
  }, []);

  const reInitializeNostrSystemCb = useCallback(() => {
    console.log(">>> NostrProvider: reInitializeNostrSystemCb called manually. <<<");
    initializeNostrSystemLogic({ current: true });
  }, [initializeNostrSystemLogic]);

  const value = useMemo((): NostrContextType => ({
    publicKey: publicKeyInternalState,
    lightningAddress: lightningAddressInternalState,
    setPublicKey: setPublicKeyCb,
    ndkReady: ndkReadyInternalState, 
    isInitialized: ndkReadyInternalState, 
    relayCount: currentRelayCountInternalState,
    ndkError: ndkErrorInternalState,
    ndk: ndkSingleton, 
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
    // ndkSingleton is stable, no need to list as dependency for useMemo value itself
  ]);

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
};

// PropTypes are removed as we are using TypeScript interfaces
// NostrProvider.propTypes = {
//   children: PropTypes.node.isRequired,
// }; 