import { useNDKWallet } from '../contexts/NDKWalletContext';

/**
 * Legacy hook for backward compatibility.
 * Now properly maps the NDK WalletContext to the old interface.
 * @deprecated Use useNDKWallet() from NDKWalletContext directly instead.
 */
export const useNip60Wallet = () => {
  const walletContext = useNDKWallet();
  
  // Map NDK context to old interface for backward compatibility
  return {
    // State - map NDK wallet state to expected interface
    walletEvent: null, // NDK manages this internally
    mintEvent: null, // NDK manages this internally  
    tokenEvents: [], // NDK manages this internally
    loading: walletContext.loading,
    error: walletContext.error,
    isInitialized: walletContext.isInitialized,
    balance: walletContext.balance?.amount || 0,
    hasWallet: walletContext.status === 'ready' && walletContext.wallet,
    currentMint: { url: walletContext.DEFAULT_MINT_URL, name: 'CoinOS' },
    walletMints: walletContext.mints || [walletContext.DEFAULT_MINT_URL],
    status: walletContext.status,
    needsSignerApproval: walletContext.needsSignerApproval,
    
    // Actions - map NDK methods to old interface
    createWallet: walletContext.initializeWallet,
    refreshWallet: walletContext.refreshBalance,
    discoverWallet: walletContext.refreshBalance,
    sendCashuPayment: walletContext.sendCashuPayment,
    receiveToken: walletContext.receiveToken,
    createDeposit: walletContext.createDeposit,
    initializeWallet: walletContext.initializeWallet,
    
    // Additional NDK-specific methods for enhanced functionality
    payLightningInvoice: walletContext.payLightningInvoice,
    getMintsWithBalance: walletContext.getMintsWithBalance,
    
    // Constants
    SUPPORTED_MINTS: walletContext.SUPPORTED_MINTS || [walletContext.DEFAULT_MINT_URL],
    DEFAULT_MINT_URL: walletContext.DEFAULT_MINT_URL
  };
}; 