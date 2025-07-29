import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNip60 } from '../contexts/WalletContext';
import { NostrContext } from '../contexts/NostrContext';
import { NDKCashuWallet, NDKNutzapMonitor } from '@nostr-dev-kit/ndk-wallet';
import { createTokenEvent, sendTokenViaDM, extractCashuToken } from '../utils/nip60Events';
import { getOrCreateWallet } from '../utils/ndkWalletUtils';

export const DashboardWalletHeader = () => {
  const navigate = useNavigate();
  const { ndk, publicKey } = useContext(NostrContext);
  const { 
    balance, 
    hasWallet: isConnected, 
    loading,
    error,
    isInitialized,
    tokenEvents: transactions,
    SUPPORTED_MINTS,
    currentMint,
    refreshWallet
  } = useNip60();

  // Add debugging
  console.log('[DashboardWalletHeader] Wallet State:', {
    hasWallet: isConnected,
    balance,
    loading,
    isInitialized,
    currentMint: currentMint?.name,
    tokenCount: transactions?.length || 0,
    walletEvent: !!hasWallet,
    error: error
  });

  // Auto-refresh if we're initialized but don't have a wallet
  // This handles cases where different hook instances get different results
  useEffect(() => {
    if (isInitialized && !isConnected && !loading && !error) {
      console.log('[DashboardWalletHeader] Wallet state seems inconsistent, refreshing...');
      refreshWallet();
    }
  }, [isInitialized, isConnected, loading, error, refreshWallet]);

  // Send Modal State
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  // Receive Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveMethod, setReceiveMethod] = useState('lightning'); // 'lightning' or 'token'
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveToken, setReceiveToken] = useState('');
  const [receiveInvoice, setReceiveInvoice] = useState('');
  const [receiveQuote, setReceiveQuote] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveSuccess, setReceiveSuccess] = useState('');

  const handleSend = () => {
    if (!isConnected) {
      navigate('/ecash');
      return;
    }
    setShowSendModal(true);
  };

  const handleReceive = () => {
    if (!isConnected) {
      navigate('/ecash');
      return;
    }
    setShowReceiveModal(true);
  };

  const handleHistory = () => {
    navigate('/ecash');
  };

  // Debug function to test error handling
  const handleDebugError = () => {
    try {
      // Test different types of errors
      const errorType = Math.random();
      if (errorType < 0.33) {
        // Test undefined error
        const undefinedError = undefined;
        undefinedError.replace('test', 'fail');
      } else if (errorType < 0.66) {
        // Test null error message
        const nullError = { message: null };
        throw nullError;
      } else {
        // Test non-string error
        const objectError = { someProperty: 'value', replace: 'not a function' };
        throw objectError;
      }
    } catch (error) {
      setReceiveError('DEBUG TEST ERROR - This should show detailed debug info in mobile-friendly format');
    }
  };

  // Handle sending tokens via NIP-61 nutzaps
  const handleSendTokens = async () => {
    if (!sendAmount || !sendRecipient) {
      setSendError('Please fill in amount and recipient');
      return;
    }

    const amount = parseInt(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setSendError('Please enter a valid amount');
      return;
    }

    if (amount > balance) {
      setSendError('Insufficient balance');
      return;
    }

    if (!currentMint?.url) {
      setSendError('No mint available');
      return;
    }

    setIsSending(true);
    setSendError('');
    setSendSuccess('');

    try {
      console.log('[DashboardWalletHeader] Getting initialized wallet for sending nutzap...');

      // Get properly initialized wallet instance
      const wallet = await getOrCreateWallet(ndk, currentMint.url);

      // Send nutzap (NIP-61) instead of manual token creation
      // This will create and publish the proper nutzap event
      const nutzapResult = await wallet.sendNutzap(sendRecipient, amount, sendMemo || 'Payment from RUNSTR');
      
      if (nutzapResult) {
        setSendSuccess(`Successfully sent ${amount} sats via nutzap!`);
        
        // Refresh wallet after sending
        setTimeout(() => {
          refreshWallet();
          setShowSendModal(false);
          setSendAmount('');
          setSendRecipient('');
          setSendMemo('');
          setSendSuccess('');
        }, 2000);
      } else {
        throw new Error('Nutzap sending failed');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Send error:', error);
      
      // Safe error message construction for send operations
      let safeErrorMessage;
      try {
        if (error && typeof error === 'object') {
          safeErrorMessage = error.message || error.toString() || JSON.stringify(error);
        } else if (error) {
          safeErrorMessage = String(error);
        } else {
          safeErrorMessage = 'Unknown error occurred';
        }
      } catch (stringError) {
        safeErrorMessage = 'Error occurred but cannot be displayed';
      }
      
      const debugInfo = `
NUTZAP SEND ERROR:
Message: ${error?.message || 'No message'}
Type: ${typeof error}
Amount: ${amount || 'none'}
Recipient: ${sendRecipient?.substring(0, 16) || 'none'}...
Balance: ${balance || 0}
Current Mint: ${currentMint?.url || 'none'}
NDK Available: ${!!ndk}
`;
      
      setSendError(`Failed to send nutzap: ${safeErrorMessage}\n\n${debugInfo}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle receiving tokens via Lightning invoice using NDK wallet
  const handleRequestInvoice = async () => {
    if (!receiveAmount) {
      setReceiveError('Please enter an amount');
      return;
    }

    const amount = parseInt(receiveAmount);
    if (isNaN(amount) || amount <= 0) {
      setReceiveError('Please enter a valid amount');
      return;
    }

    if (!currentMint?.url) {
      setReceiveError('No mint available');
      return;
    }

    setIsReceiving(true);
    setReceiveError('');

    try {
      console.log('[DashboardWalletHeader] Getting initialized wallet for generating deposit invoice...');

      // Get properly initialized wallet instance
      const wallet = await getOrCreateWallet(ndk, currentMint.url);

      // Use wallet.deposit() method instead of direct mint operations
      const deposit = wallet.deposit(amount, currentMint.url);
      const bolt11 = await deposit.start(); // Get Lightning invoice
      
      if (!bolt11) {
        throw new Error('Failed to generate Lightning invoice');
      }

      setReceiveInvoice(bolt11);
      setReceiveSuccess(`Invoice created for ${amount} sats`);

      // Listen for successful payment
      deposit.on("success", () => {
        console.log("[DashboardWalletHeader] Payment received!", wallet.balance);
        setReceiveSuccess(`Payment received! ${amount} sats added to wallet.`);
        refreshWallet(); // Update wallet state
      });

    } catch (error) {
      console.error('[DashboardWalletHeader] Invoice error:', error);
      
      // Create detailed error information for mobile debugging
      const errorDetails = {
        message: error?.message || 'No message',
        type: typeof error,
        isError: error instanceof Error,
        keys: error ? Object.keys(error) : [],
        string: error?.toString?.() || 'Cannot convert to string',
        stack: error?.stack || 'No stack trace'
      };
      
      // Safe error message construction
      let safeErrorMessage;
      try {
        if (error && typeof error === 'object') {
          safeErrorMessage = error.message || error.toString() || JSON.stringify(error);
        } else if (error) {
          safeErrorMessage = String(error);
        } else {
          safeErrorMessage = 'Unknown error occurred';
        }
      } catch (stringError) {
        safeErrorMessage = 'Error occurred but cannot be displayed';
      }
      
      // Create comprehensive debug message for UI
      const debugInfo = `
ERROR DETAILS:
Message: ${errorDetails.message}
Type: ${errorDetails.type}
Is Error Object: ${errorDetails.isError}
Object Keys: ${errorDetails.keys.join(', ')}
String Conversion: ${errorDetails.string}
Stack (first 200 chars): ${errorDetails.stack.substring(0, 200)}

CONTEXT:
Amount: ${amount}
Current Mint: ${currentMint?.url || 'none'}
NDK Available: ${!!ndk}
NDK Connected: ${ndk?.pool?.connectedRelays?.length || 0} relays
`;
      
      setReceiveError(`Failed to create invoice: ${safeErrorMessage}\n\n${debugInfo}`);
    } finally {
      setIsReceiving(false);
    }
  };

  // Handle receiving tokens via NDK wallet
  const handleReceiveToken = async () => {
    if (!receiveToken) {
      setReceiveError('Please paste a token');
      return;
    }

    setIsReceiving(true);
    setReceiveError('');

    try {
      console.log('[DashboardWalletHeader] Getting initialized wallet for receiving token...');

      // Get properly initialized wallet instance
      const wallet = await getOrCreateWallet(ndk, currentMint.url);

      // Use wallet.receiveToken() method instead of manual parsing
      const tokenEvent = await wallet.receiveToken(receiveToken);
      
      if (tokenEvent) {
        // Get the amount from the token event
        const amount = tokenEvent.amount || 0;
        setReceiveSuccess(`Successfully received ${amount} sats!`);
        
        // Refresh wallet after receiving
        setTimeout(() => {
          refreshWallet();
          setShowReceiveModal(false);
          setReceiveToken('');
          setReceiveSuccess('');
        }, 2000);
      } else {
        throw new Error('Token reception failed');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Receive error:', error);
      
      // Safe error message construction for token receive
      let safeErrorMessage;
      try {
        if (error && typeof error === 'object') {
          safeErrorMessage = error.message || error.toString() || JSON.stringify(error);
        } else if (error) {
          safeErrorMessage = String(error);
        } else {
          safeErrorMessage = 'Unknown error occurred';
        }
      } catch (stringError) {
        safeErrorMessage = 'Error occurred but cannot be displayed';
      }
      
      const debugInfo = `
TOKEN RECEIVE ERROR:
Message: ${error?.message || 'No message'}
Type: ${typeof error}
Token Length: ${receiveToken?.length || 0}
Token Preview: ${receiveToken?.substring(0, 50) || 'empty'}...
Current Mint: ${currentMint?.url || 'none'}
`;
      
      setReceiveError(`Failed to receive token: ${safeErrorMessage}\n\n${debugInfo}`);
    } finally {
      setIsReceiving(false);
    }
  };

  const formatBalance = (sats) => {
    if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}k`;
    }
    return sats.toString();
  };

  if (!isConnected) {
    return (
      <div className="dashboard-wallet-header">
        <div className="wallet-card disconnected">
          <div className="wallet-status">
            <span className="status-text">
              {loading ? 'Checking for wallet...' : 
               'Wallet Not Initialized'}
            </span>
          </div>
          <button 
            className="connect-button"
            onClick={() => navigate('/ecash')}
            disabled={loading}
          >
            {loading ? '...' : 'Initialize Wallet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-wallet-header">
        <div className="wallet-card">
          <div className="balance-section">
            <div className="balance-amount">{formatBalance(balance)}</div>
            <div className="balance-unit">sats</div>
          </div>
          
          <div className="wallet-actions">
            <button 
              className="action-button send-button" 
              onClick={handleSend}
              disabled={balance <= 0}
            >
              Send
            </button>
            <button className="action-button receive-button" onClick={handleReceive}>
              Receive
            </button>
            <button className="action-button history-button" onClick={handleHistory}>
              <span className="hamburger-icon">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <button 
              className="action-button debug-button" 
              onClick={handleDebugError}
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                fontSize: '0.7rem',
                minWidth: '45px'
              }}
              title="Test error handling"
            >
              🐛
            </button>
          </div>
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Send Sats</h3>
            <p><strong>Available Balance:</strong> {balance.toLocaleString()} sats</p>
            
            {sendError && (
              <div className="error-message" style={{ 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-primary)', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                border: '1px solid var(--border-primary)'
              }}>
                {sendError}
              </div>
            )}

            {sendSuccess && (
              <div className="success-message" style={{ 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-primary)', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem',
                border: '1px solid var(--border-primary)'
              }}>
                {sendSuccess}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                Recipient (Nostr pubkey):
              </label>
              <input
                type="text"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder="npub... or hex pubkey"
                disabled={isSending}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                Amount (sats):
              </label>
              <input
                type="number"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0"
                min="1"
                max={balance}
                disabled={isSending}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                Memo (optional):
              </label>
              <input
                type="text"
                value={sendMemo}
                onChange={(e) => setSendMemo(e.target.value)}
                placeholder="Payment description"
                disabled={isSending}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            
            <div className="modal-buttons">
              <button 
                onClick={() => {
                  setShowSendModal(false);
                  setSendError('');
                  setSendSuccess('');
                }}
                className="cancel-button"
                disabled={isSending}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendTokens}
                className="send-confirm-button"
                disabled={isSending || !sendAmount || !sendRecipient}
                style={{
                  opacity: (isSending || !sendAmount || !sendRecipient) ? 0.6 : 1
                }}
              >
                {isSending ? 'Sending...' : 'Send Tokens'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Receive Sats</h3>
            
            {receiveError && (
              <div className="error-message" style={{ 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-primary)', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                border: '1px solid var(--border-primary)'
              }}>
                {receiveError}
              </div>
            )}

            {receiveSuccess && (
              <div className="success-message" style={{ 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-primary)', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem',
                border: '1px solid var(--border-primary)'
              }}>
                {receiveSuccess}
              </div>
            )}

            {/* Method Selection */}
            <div className="receive-method-tabs" style={{ 
              display: 'flex', 
              marginBottom: '16px', 
              borderBottom: '1px solid var(--border-color)' 
            }}>
              <button
                onClick={() => setReceiveMethod('lightning')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  background: receiveMethod === 'lightning' ? 'var(--primary)' : 'transparent',
                  color: receiveMethod === 'lightning' ? 'white' : 'var(--text-primary)',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer'
                }}
              >
                ⚡ Lightning Invoice
              </button>
              <button
                onClick={() => setReceiveMethod('token')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  background: receiveMethod === 'token' ? 'var(--primary)' : 'transparent',
                  color: receiveMethod === 'token' ? 'white' : 'var(--text-primary)',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer'
                }}
              >
                🎫 Paste Token
              </button>
            </div>

            {receiveMethod === 'lightning' ? (
              <>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                    Amount (sats):
                  </label>
                  <input
                    type="number"
                    value={receiveAmount}
                    onChange={(e) => setReceiveAmount(e.target.value)}
                    placeholder="0"
                    min="1"
                    disabled={isReceiving}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--background-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {receiveInvoice && (
                  <div className="invoice-display" style={{ 
                    marginBottom: '12px',
                    padding: '12px',
                    background: 'var(--background-secondary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      Lightning Invoice:
                    </label>
                    <textarea
                      value={receiveInvoice}
                      readOnly
                      style={{
                        width: '100%',
                        height: '80px',
                        padding: '8px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--background-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                        resize: 'none'
                      }}
                    />
                    <div style={{ 
                      marginTop: '8px', 
                      display: 'flex', 
                      gap: '8px' 
                    }}>
                      <button
                        onClick={() => navigator.clipboard.writeText(receiveInvoice)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.8rem',
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Copy
                      </button>
                      <small style={{ color: 'var(--text-secondary)', alignSelf: 'center' }}>
                        Share this invoice to receive {receiveAmount} sats
                      </small>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      setShowReceiveModal(false);
                      setReceiveError('');
                      setReceiveSuccess('');
                      setReceiveInvoice('');
                    }}
                    className="cancel-button"
                    disabled={isReceiving}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleRequestInvoice}
                    className="receive-confirm-button"
                    disabled={isReceiving || !receiveAmount}
                    style={{
                      flex: 1,
                      opacity: (isReceiving || !receiveAmount) ? 0.6 : 1
                    }}
                  >
                    {isReceiving ? 'Creating...' : 'Create Invoice'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                    Paste Ecash Token:
                  </label>
                  <textarea
                    value={receiveToken}
                    onChange={(e) => setReceiveToken(e.target.value)}
                    placeholder="cashu... (paste the token you received)"
                    disabled={isReceiving}
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '8px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--background-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                      resize: 'none'
                    }}
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Paste a cashu token that someone sent you via DM or QR code
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      setShowReceiveModal(false);
                      setReceiveError('');
                      setReceiveSuccess('');
                      setReceiveToken('');
                    }}
                    className="cancel-button"
                    disabled={isReceiving}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleReceiveToken}
                    className="receive-confirm-button"
                    disabled={isReceiving || !receiveToken}
                    style={{
                      flex: 1,
                      opacity: (isReceiving || !receiveToken) ? 0.6 : 1
                    }}
                  >
                    {isReceiving ? 'Receiving...' : 'Receive Token'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}; 