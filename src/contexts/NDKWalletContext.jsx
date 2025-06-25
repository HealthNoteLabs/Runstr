import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim.js';
import { NDKCashuWallet, NDKNutzapMonitor } from '@nostr-dev-kit/ndk-wallet';
import { NDKCashuMintList, NDKKind } from '@nostr-dev-kit/ndk';

// Default mint for new users (CoinOS) - now part of array for fallback support
const DEFAULT_MINT_URL = 'https://mint.coinos.io';

// Multiple mint support for graceful fallbacks
const SUPPORTED_MINTS = [
  { url: 'https://mint.coinos.io', name: 'CoinOS', priority: 1 },
  { url: 'https://mint.minibits.cash', name: 'Minibits', priority: 2 }, 
  { url: 'https://mint.0xchat.com', name: '0xChat', priority: 3 }
];

const NDKWalletContext = createContext();

export const NDKWalletProvider = ({ children }) => {
  const { ndk, publicKey } = useContext(NostrContext);
  
  // Wallet instances
  const walletRef = useRef(null);
  const nutzapMonitorRef = useRef(null);
  
  // Wallet state with granular status tracking
  const [walletState, setWalletState] = useState({
    wallet: null,
    nutzapMonitor: null,
    balance: { amount: 0 },
    mints: [],
    loading: false,
    error: null,
    isInitialized: false,
    status: 'initial', // initial, discovering, creating, publishing, ready, failed, partial
    needsSignerApproval: false,
    p2pk: null,
    // Retry and fallback state
    retryCount: 0,
    canRetry: false,
    partialMode: false,
    activeMint: null,
    failedMints: [],
    // Nutzap status tracking
    nutzapStats: {
      pending: 0,
      failed: 0,
      redeemed: 0,
      total: 0
    },
    lastNutzapRefresh: null
  });

  // Initialize wallet when NDK and user are ready
  useEffect(() => {
    if (ndk && publicKey && !walletState.isInitialized) {
      initializeWallet();
    }
  }, [ndk, publicKey, walletState.isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (walletRef.current) {
        walletRef.current.stop();
      }
      if (nutzapMonitorRef.current) {
        nutzapMonitorRef.current.stop();
      }
    };
  }, []);

  /**
   * Check for existing wallet events (Phase 1: Critical Fix)
   */
  const findExistingWallet = async (ndk) => {
    try {
      const activeUser = ndk.activeUser;
      if (!activeUser) {
        console.log('[NDKWallet] No active user available for wallet discovery');
        return null;
      }

      console.log('[NDKWallet] Searching for existing wallet events...');
      
      const event = await ndk.fetchEvent({
        kinds: [NDKKind.CashuWallet],
        authors: [activeUser.pubkey]
      });

      if (event) {
        console.log('[NDKWallet] Found existing wallet event:', event.id);
        return await NDKCashuWallet.from(event);
      }
      
      console.log('[NDKWallet] No existing wallet found');
      return null;
    } catch (error) {
      console.error('[NDKWallet] Error finding existing wallet:', error);
      return null;
    }
  };

  /**
   * Initialize the NDK Cashu wallet with discovery logic
   */
  const initializeWallet = async () => {
    if (!ndk) {
      console.log('[NDKWallet] NDK not available, cannot initialize wallet');
      setWalletState(prev => ({
        ...prev,
        error: 'Network connection not ready. Please wait for connection to initialize.',
        isInitialized: true,
        status: 'failed'
      }));
      return;
    }

    if (!publicKey) {
      console.log('[NDKWallet] PublicKey not available, waiting for authentication...');
      setWalletState(prev => ({
        ...prev,
        error: null,
        loading: true,
        status: 'waiting_for_auth',
        isInitialized: false
      }));
      return;
    }

    setWalletState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      status: 'discovering',
      needsSignerApproval: false
    }));

    try {
      console.log('[NDKWallet] Starting wallet initialization...');

      // Phase 1: Check for existing wallet first
      setWalletState(prev => ({ ...prev, status: 'discovering' }));
      let wallet = await findExistingWallet(ndk);

      if (!wallet) {
        // Phase 1: Create new wallet if none exists
        console.log('[NDKWallet] Creating new Cashu wallet...');
        setWalletState(prev => ({ ...prev, status: 'creating' }));
        
        wallet = new NDKCashuWallet(ndk);
        walletRef.current = wallet;

        // Use proper mint management API
        await wallet.addMint(DEFAULT_MINT_URL);
        
        // Set explicit relays as per documentation
        wallet.relays = Array.from(ndk.pool.relays.keys());

        // Generate p2pk for nutzap reception
        const p2pk = await wallet.getP2pk();
        console.log('[NDKWallet] Generated p2pk:', p2pk);

        setWalletState(prev => ({ ...prev, p2pk }));

        // Phase 1: Publish wallet metadata (Critical Fix)
        setWalletState(prev => ({ ...prev, status: 'publishing' }));
        console.log('[NDKWallet] Publishing wallet metadata...');
        
        try {
          await wallet.publish();
          console.log('[NDKWallet] Wallet metadata published successfully');

          // Phase 1: Setup nutzap reception with NDKCashuMintList
          console.log('[NDKWallet] Setting up nutzap reception...');
          const mintList = new NDKCashuMintList(ndk);
          mintList.relays = wallet.relays || ndk.pool.relays.keys();
          mintList.mints = wallet.mints;
          mintList.p2pk = p2pk;
          
          await mintList.publish();
          console.log('[NDKWallet] Nutzap mintlist published successfully');
          
        } catch (publishError) {
          console.error('[NDKWallet] Publishing failed:', publishError);
          
          // Enhanced error handling for signing failures
          if (publishError.message.includes('rejected') || 
              publishError.message.includes('signer') ||
              publishError.message.includes('denied')) {
            setWalletState(prev => ({
              ...prev,
              error: 'Signing required: Please approve the Amber request to publish your wallet',
              needsSignerApproval: true,
              status: 'failed'
            }));
            return;
          }
          
          throw publishError;
        }
      } else {
        // Existing wallet found - restore it
        console.log('[NDKWallet] Restoring existing wallet...');
        walletRef.current = wallet;
        
        // Get existing p2pk
        const p2pk = await wallet.getP2pk();
        setWalletState(prev => ({ ...prev, p2pk }));
      }

      // Phase 1: Full NDK integration (Critical Fix)
      ndk.wallet = wallet;
      console.log('[NDKWallet] Wallet integrated with NDK');

      // Set up event listeners
      wallet.on('ready', () => {
        console.log('[NDKWallet] Wallet ready');
        setWalletState(prev => ({
          ...prev,
          status: 'ready',
          loading: false
        }));
      });

      wallet.on('balance_updated', (balance) => {
        console.log('[NDKWallet] Balance updated:', balance);
        setWalletState(prev => ({
          ...prev,
          balance: balance || { amount: 0 }
        }));
      });

      wallet.on('warning', (warning) => {
        console.warn('[NDKWallet] Warning:', warning);
      });

      wallet.on('error', (error) => {
        console.error('[NDKWallet] Wallet error:', error);
        setWalletState(prev => ({
          ...prev,
          error: error.message || 'Wallet error occurred'
        }));
      });

      // Start the wallet
      await wallet.start({ pubkey: publicKey });

      // Initialize nutzap monitor
      await initializeNutzapMonitor(wallet);

      // Update final state
      setWalletState(prev => ({
        ...prev,
        wallet,
        mints: wallet.mints || [DEFAULT_MINT_URL],
        balance: wallet.balance || { amount: 0 },
        loading: false,
        error: null,
        isInitialized: true,
        status: 'ready'
      }));

      console.log('[NDKWallet] Wallet initialized successfully');

    } catch (error) {
      console.error('[NDKWallet] Failed to initialize wallet:', error);
      
      // Enhanced error handling for different failure types
      let errorMessage = 'Failed to initialize wallet';
      let needsSignerApproval = false;
      
      if (error.message.includes('rejected') || 
          error.message.includes('signer') ||
          error.message.includes('denied')) {
        errorMessage = 'Signing required: Please approve the Amber requests to initialize your wallet';
        needsSignerApproval = true;
      } else if (error.message.includes('relay') || error.message.includes('connection')) {
        errorMessage = 'Network error: Unable to connect to Nostr relays';
      } else if (error.message.includes('mint')) {
        errorMessage = 'Mint error: Unable to connect to Cashu mint';
      }
      
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        needsSignerApproval,
        isInitialized: true,
        status: 'failed'
      }));
    }
  };

  /**
   * Initialize the nutzap monitor for automatic nutzap handling
   */
  const initializeNutzapMonitor = async (wallet) => {
    try {
      console.log('[NDKWallet] Initializing nutzap monitor...');

      const user = ndk.activeUser;
      if (!user) {
        throw new Error('No active user available');
      }

      // Create mint list for nutzap reception (as per documentation)
      const mintListForNutzapReception = new NDKCashuMintList(ndk);
      mintListForNutzapReception.relays = wallet.relays || Array.from(ndk.pool.relays.keys());
      mintListForNutzapReception.mints = wallet.mints;
      mintListForNutzapReception.p2pk = wallet.p2pk;

      // Create nutzap monitor with mintList parameter (HIGH PRIORITY FIX)
      const monitor = new NDKNutzapMonitor(ndk, user, {
        mintList: mintListForNutzapReception,
        // store automatically derived from ndk.cacheAdapter if available
      });

      nutzapMonitorRef.current = monitor;
      monitor.wallet = wallet;

      // Enhanced event listeners
      monitor.on('redeemed', (nutzaps, amount) => {
        console.log('[NDKWallet] Nutzaps redeemed:', nutzaps.length, 'amount:', amount);
        // Trigger balance refresh
        refreshBalance();
      });

      monitor.on('seen', (nutzap) => {
        console.log('[NDKWallet] New nutzap seen:', nutzap.id);
      });

      monitor.on('failed', (nutzap, error) => {
        console.error('[NDKWallet] Nutzap redemption failed:', nutzap.id, error);
      });

      monitor.on('error', (error) => {
        console.error('[NDKWallet] Nutzap monitor error:', error);
      });

      // Start monitoring
      await monitor.start({});

      setWalletState(prev => ({
        ...prev,
        nutzapMonitor: monitor
      }));

      console.log('[NDKWallet] Nutzap monitor initialized successfully');

    } catch (error) {
      console.error('[NDKWallet] Failed to initialize nutzap monitor:', error);
      // Don't fail the whole wallet if nutzap monitor fails
    }
  };

  /**
   * Enhanced balance refresh with explicit getBalance calls
   */
  const refreshBalance = async () => {
    const wallet = walletRef.current;
    if (!wallet) {
      console.log('[NDKWallet] No wallet available for balance refresh');
      return;
    }

    try {
      console.log('[NDKWallet] Refreshing wallet balance...');
      
      // Use explicit balance retrieval if available
      if (typeof wallet.getBalance === 'function') {
        const balance = await wallet.getBalance();
        setWalletState(prev => ({
          ...prev,
          balance: balance || { amount: 0 }
        }));
      } else {
        // Fallback to current balance property
        const balance = wallet.balance || { amount: 0 };
        setWalletState(prev => ({
          ...prev,
          balance
        }));
      }
      
      console.log('[NDKWallet] Balance refreshed');
    } catch (error) {
      console.error('[NDKWallet] Failed to refresh balance:', error);
    }
  };

  /**
   * Get balance for specific mint
   */
  const getMintBalance = (mintUrl) => {
    const wallet = walletRef.current;
    if (!wallet || typeof wallet.mintBalance !== 'function') {
      return 0;
    }
    
    try {
      return wallet.mintBalance(mintUrl);
    } catch (error) {
      console.error('[NDKWallet] Failed to get mint balance:', error);
      return 0;
    }
  };

  /**
   * Send a cashu payment
   */
  const sendCashuPayment = async (recipientPubkey, amount, memo = '') => {
    const wallet = walletRef.current;
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      console.log(`[NDKWallet] Sending ${amount} sats to ${recipientPubkey.substring(0, 8)}...`);

      // Use the wallet's cashuPay method
      const result = await wallet.cashuPay({
        pubkey: recipientPubkey,
        amount,
        comment: memo,
        p2pk: recipientPubkey // Send to recipient's pubkey
      });

      console.log('[NDKWallet] Payment sent successfully:', result);
      
      // Trigger balance refresh
      await refreshBalance();
      
      return result;
    } catch (error) {
      console.error('[NDKWallet] Payment failed:', error);
      
      // Enhanced error handling for payment failures
      if (error.message.includes('insufficient') || error.message.includes('balance')) {
        throw new Error('Insufficient balance for payment');
      } else if (error.message.includes('rejected') || error.message.includes('signer')) {
        throw new Error('Payment cancelled: Signing required but was rejected');
      }
      
      throw error;
    }
  };

  /**
   * Pay a Lightning invoice
   */
  const payLightningInvoice = async (invoice, memo = '') => {
    const wallet = walletRef.current;
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      console.log('[NDKWallet] Paying Lightning invoice...');

      // Use the wallet's lnPay method
      const result = await wallet.lnPay({
        pr: invoice,
        comment: memo
      });

      console.log('[NDKWallet] Lightning payment successful:', result);
      return result;

    } catch (error) {
      console.error('[NDKWallet] Failed to pay Lightning invoice:', error);
      throw error;
    }
  };

  /**
   * Receive a cashu token
   */
  const receiveToken = async (tokenString, description = '') => {
    const wallet = walletRef.current;
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      console.log('[NDKWallet] Receiving token...');

      // Use the wallet's receiveToken method
      const result = await wallet.receiveToken(tokenString, description);

      console.log('[NDKWallet] Token received successfully:', result);
      return result;

    } catch (error) {
      console.error('[NDKWallet] Failed to receive token:', error);
      throw error;
    }
  };

  /**
   * Create a Lightning deposit
   */
  const createDeposit = (amount) => {
    const wallet = walletRef.current;
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      console.log(`[NDKWallet] Creating deposit for ${amount} sats...`);

      // Use the wallet's deposit method
      const deposit = wallet.deposit(amount, DEFAULT_MINT_URL);

      return deposit;

    } catch (error) {
      console.error('[NDKWallet] Failed to create deposit:', error);
      throw error;
    }
  };

  /**
   * Get mints with sufficient balance
   */
  const getMintsWithBalance = (amount) => {
    const wallet = walletRef.current;
    if (!wallet) {
      return [];
    }

    return wallet.getMintsWithBalance(amount);
  };

  /**
   * Manual nutzap refresh - retry MISSING_PRIVKEY nutzaps
   */
  const refreshNutzaps = async () => {
    const monitor = nutzapMonitorRef.current;
    if (!monitor) {
      console.log('[NDKWallet] No nutzap monitor available for refresh');
      return { success: false, message: 'Nutzap monitor not available' };
    }

    try {
      console.log('[NDKWallet] Manually refreshing nutzaps...');
      
      setWalletState(prev => ({
        ...prev,
        lastNutzapRefresh: new Date().toISOString()
      }));

      // Get pending nutzaps with MISSING_PRIVKEY status
      let retriedCount = 0;
      
      // Try to access monitor's internal nutzap cache/store if available
      if (monitor.store && typeof monitor.store.getAllNutzaps === 'function') {
        const allNutzaps = await monitor.store.getAllNutzaps();
        const pendingNutzaps = allNutzaps.filter(n => n.status === 'MISSING_PRIVKEY');
        
        console.log(`[NDKWallet] Found ${pendingNutzaps.length} pending nutzaps to retry`);
        
        // Retry redemption for each pending nutzap
        for (const nutzap of pendingNutzaps) {
          try {
            await monitor.redeemNutzap(nutzap);
            retriedCount++;
          } catch (error) {
            console.warn(`[NDKWallet] Failed to retry nutzap ${nutzap.id}:`, error);
          }
        }
      } else {
        // Fallback: restart the monitor to trigger retry of cached nutzaps
        console.log('[NDKWallet] Restarting nutzap monitor to retry cached nutzaps...');
        await monitor.stop();
        await monitor.start({});
        retriedCount = 1; // Can't count individual retries in this mode
      }

      // Trigger balance refresh after retry attempts
      await refreshBalance();

      const message = retriedCount > 0 
        ? `Retried ${retriedCount} pending nutzaps` 
        : 'No pending nutzaps found to retry';

      console.log(`[NDKWallet] Nutzap refresh completed: ${message}`);
      
      return { 
        success: true, 
        message,
        retriedCount,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[NDKWallet] Failed to refresh nutzaps:', error);
      return { 
        success: false, 
        message: `Nutzap refresh failed: ${error.message}`,
        error: error.message
      };
    }
  };

  /**
   * Retry wallet initialization with improved error handling
   */
  const retryInitialization = async () => {
    console.log('[NDKWallet] Retrying wallet initialization...');
    
    setWalletState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      canRetry: false,
      error: null
    }));

    // Reset wallet state before retry
    if (walletRef.current) {
      try {
        walletRef.current.stop();
      } catch (e) {
        console.warn('[NDKWallet] Error stopping existing wallet:', e);
      }
      walletRef.current = null;
    }

    if (nutzapMonitorRef.current) {
      try {
        nutzapMonitorRef.current.stop();
      } catch (e) {
        console.warn('[NDKWallet] Error stopping existing monitor:', e);
      }
      nutzapMonitorRef.current = null;
    }

    // Clear NDK wallet reference
    if (ndk.wallet) {
      ndk.wallet = null;
    }

    // Attempt initialization again
    await initializeWallet();
  };

  /**
   * Initialize wallet with multiple mint fallback support
   */
  const initializeWalletWithFallback = async (mintIndex = 0) => {
    if (mintIndex >= SUPPORTED_MINTS.length) {
      throw new Error('All supported mints failed to initialize');
    }

    const mint = SUPPORTED_MINTS[mintIndex];
    console.log(`[NDKWallet] Attempting to initialize with mint: ${mint.name} (${mint.url})`);

    try {
      const wallet = new NDKCashuWallet(ndk);
      await wallet.addMint(mint.url);
      
      setWalletState(prev => ({
        ...prev,
        activeMint: mint,
        failedMints: prev.failedMints
      }));

      return wallet;
    } catch (error) {
      console.error(`[NDKWallet] Failed to initialize with ${mint.name}:`, error);
      
      setWalletState(prev => ({
        ...prev,
        failedMints: [...prev.failedMints, mint]
      }));

      // Try next mint
      return await initializeWalletWithFallback(mintIndex + 1);
    }
  };

  /**
   * Enable partial functionality mode when full initialization fails
   */
  const enablePartialMode = () => {
    console.log('[NDKWallet] Enabling partial functionality mode');
    
    setWalletState(prev => ({
      ...prev,
      status: 'partial',
      partialMode: true,
      canRetry: true,
      loading: false,
      error: 'Limited functionality: Some features may not work. You can retry full initialization.'
    }));
  };

  /**
   * Reset wallet state and clear cache
   */
  const resetWallet = async () => {
    console.log('[NDKWallet] Resetting wallet state...');
    
    // Stop existing instances
    if (walletRef.current) {
      try {
        walletRef.current.stop();
      } catch (e) {
        console.warn('[NDKWallet] Error stopping wallet:', e);
      }
      walletRef.current = null;
    }

    if (nutzapMonitorRef.current) {
      try {
        nutzapMonitorRef.current.stop();
      } catch (e) {
        console.warn('[NDKWallet] Error stopping monitor:', e);
      }
      nutzapMonitorRef.current = null;
    }

    // Clear NDK wallet reference
    if (ndk && ndk.wallet) {
      ndk.wallet = null;
    }

    // Reset state to initial
    setWalletState({
      wallet: null,
      nutzapMonitor: null,
      balance: { amount: 0 },
      mints: [],
      loading: false,
      error: null,
      isInitialized: false,
      status: 'initial',
      needsSignerApproval: false,
      p2pk: null,
      retryCount: 0,
      canRetry: false,
      partialMode: false,
      activeMint: null,
      failedMints: [],
      nutzapStats: {
        pending: 0,
        failed: 0,
        redeemed: 0,
        total: 0
      },
      lastNutzapRefresh: null
    });

    console.log('[NDKWallet] Wallet state reset completed');
  };

  const contextValue = {
    // State
    ...walletState,
    
    // Actions
    initializeWallet,
    sendCashuPayment,
    payLightningInvoice,
    receiveToken,
    createDeposit,
    refreshBalance,
    getMintsWithBalance,
    refreshNutzaps,
    retryInitialization,
    resetWallet,
    
    // Wallet instance access (for advanced usage)
    wallet: walletRef.current,
    nutzapMonitor: nutzapMonitorRef.current,
    
    // Constants
    DEFAULT_MINT_URL,
    SUPPORTED_MINTS
  };

  return (
    <NDKWalletContext.Provider value={contextValue}>
      {children}
    </NDKWalletContext.Provider>
  );
};

export const useNDKWallet = () => {
  const context = useContext(NDKWalletContext);
  if (!context) {
    throw new Error('useNDKWallet must be used within NDKWalletProvider');
  }
  return context;
};

// Alias for backward compatibility
export const useNip60 = useNDKWallet; 