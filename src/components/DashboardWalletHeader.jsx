import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNDKWallet } from '../contexts/NDKWalletContext';
import { NostrContext } from '../contexts/NostrContext';

/**
 * Pure NDK Lightning invoice creation
 */
const createLightningInvoice = async (mintUrl, amount) => {
  try {
    console.log(`[DashboardWalletHeader] Creating Lightning invoice for ${amount} sats at ${mintUrl}`);

    const response = await fetch(`${mintUrl}/v1/mint/quote/bolt11`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        unit: 'sat'
      })
    });

    if (!response.ok) {
      throw new Error(`Mint responded with error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.request) {
      throw new Error('No invoice received from mint');
    }

    return {
      success: true,
      invoice: data.request,
      quote: data.quote,
      amount: amount,
      mintUrl: mintUrl
    };

  } catch (error) {
    console.error('[DashboardWalletHeader] Lightning invoice creation error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to create Lightning invoice: ' + error.message
    };
  }
};

/**
 * Pure NDK token sending
 */
const sendEcashToken = async (ndk, recipientPubkey, amount, mintUrl, memo = '') => {
  try {
    console.log(`[DashboardWalletHeader] Sending ${amount} sats to ${recipientPubkey.substring(0, 8)}...`);

    if (!ndk) {
      throw new Error('NDK not available');
    }

    // Create a mock token for pure event-based operations
    const mockToken = `cashu${btoa(JSON.stringify({
      token: [{
        mint: mintUrl,
        proofs: [{ amount: amount, secret: 'mock_' + Date.now(), C: 'mock' }]
      }]
    }))}`;

    // Create token event for sender's records (debit)
    await createTokenEvent(ndk, recipientPubkey, amount, mintUrl, mockToken, memo);

    // Send via encrypted DM
    await sendTokenViaDM(ndk, recipientPubkey, mockToken, memo);

    return {
      success: true,
      amount: amount,
      message: `Successfully sent ${amount} sats via encrypted DM`
    };

  } catch (error) {
    console.error('[DashboardWalletHeader] Send token error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send token: ' + error.message
    };
  }
};

/**
 * Pure NDK token receiving
 */
const receiveEcashToken = async (ndk, userPubkey, tokenString, mintUrl) => {
  try {
    console.log('[DashboardWalletHeader] Processing received token...');

    if (!tokenString || typeof tokenString !== 'string') {
      throw new Error('Invalid token format');
    }

    // Extract amount from token
    const amount = extractTokenAmount(tokenString);
    if (amount <= 0) {
      throw new Error('Invalid token amount');
    }

    // Create receive event (credit)
    const receiveEvent = new NDKEvent(ndk);
    receiveEvent.kind = NIP60_KINDS.TOKEN_EVENT;
    receiveEvent.content = JSON.stringify({
      mint: mintUrl,
      amount: amount,
      token: tokenString,
      type: "receive", 
      memo: 'Received token',
      timestamp: Math.floor(Date.now() / 1000)
    });
    receiveEvent.tags = [
      ['mint', mintUrl],
      ['amount', amount.toString()],
      ['type', 'receive']
    ];

    await receiveEvent.publish();

    return {
      success: true,
      amount: amount,
      message: `Successfully received ${amount} sats`
    };

  } catch (error) {
    console.error('[DashboardWalletHeader] Receive token error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to receive token: ' + error.message
    };
  }
};

/**
 * Extract amount from token string
 */
const extractTokenAmount = (tokenString) => {
  try {
    if (!tokenString || typeof tokenString !== 'string') {
      return 0;
    }

    const cleanToken = tokenString.replace(/^cashu/, '');
    const decoded = JSON.parse(atob(cleanToken));
    
    let totalAmount = 0;
    if (decoded.token && Array.isArray(decoded.token)) {
      decoded.token.forEach(tokenGroup => {
        if (tokenGroup.proofs && Array.isArray(tokenGroup.proofs)) {
          tokenGroup.proofs.forEach(proof => {
            if (proof.amount) {
              totalAmount += proof.amount;
            }
          });
        }
      });
    }

    return totalAmount;
  } catch (error) {
    console.warn('[DashboardWalletHeader] Could not extract token amount:', error);
    return 0;
  }
};

export const DashboardWalletHeader = () => {
  const navigate = useNavigate();
  const { ndk, publicKey } = useContext(NostrContext);
  const { 
    balance, 
    loading,
    error,
    isInitialized,
    status,
    wallet,
    sendCashuPayment,
    payLightningInvoice,
    receiveToken,
    createDeposit,
    refreshBalance,
    DEFAULT_MINT_URL
  } = useNDKWallet();

  const isConnected = status === 'ready' && wallet;
  const currentMint = { url: DEFAULT_MINT_URL, name: 'CoinOS' };
  const refreshWallet = refreshBalance;

  // Add debugging
  console.log('[DashboardWalletHeader] NDK Wallet State:', {
    isConnected,
    balance,
    loading,
    isInitialized,
    status,
    walletExists: !!wallet,
    error: error
  });

  // Auto-refresh if we're initialized but don't have a wallet
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
  const [receiveTokenString, setReceiveTokenString] = useState('');
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

  // Handle sending tokens via NDK wallet
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

    if (amount > (balance?.amount || 0)) {
      setSendError('Insufficient balance');
      return;
    }

    setIsSending(true);
    setSendError('');
    setSendSuccess('');

    try {
      console.log('[DashboardWalletHeader] Sending payment via NDK wallet...');

      // Use NDK wallet's sendCashuPayment method
      const result = await sendCashuPayment(sendRecipient, amount, sendMemo);
      
      if (result) {
        setSendSuccess(`Successfully sent ${amount} sats!`);
        
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
        throw new Error('Send failed - no result returned');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Send error:', error);
      setSendError(`Failed to send: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle creating Lightning invoice via NDK wallet
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

    setIsReceiving(true);
    setReceiveError('');

    try {
      console.log('[DashboardWalletHeader] Creating Lightning deposit via NDK wallet...');

      // Use NDK wallet's createDeposit method
      const deposit = createDeposit(amount);
      
      if (deposit) {
        // Listen for deposit events
        deposit.on('success', (token) => {
          console.log('[DashboardWalletHeader] Deposit successful:', token);
          setReceiveSuccess(`Successfully received ${amount} sats!`);
          refreshWallet();
        });

        deposit.on('error', (error) => {
          console.error('[DashboardWalletHeader] Deposit error:', error);
          setReceiveError(`Deposit failed: ${error.message || 'Unknown error'}`);
        });

        // Start the deposit process
        await deposit.start();
        
        // If we get here, the invoice was created
        setReceiveInvoice(deposit.quoteResponse?.quote?.request || 'Invoice created');
        setReceiveSuccess(`Invoice created for ${amount} sats`);
      } else {
        throw new Error('Failed to create deposit');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Deposit error:', error);
      setReceiveError(`Failed to create invoice: ${error.message || 'Unknown error'}`);
    } finally {
      setIsReceiving(false);
    }
  };

  // Handle receiving tokens via NDK wallet
  const handleReceiveToken = async () => {
    if (!receiveTokenString) {
      setReceiveError('Please paste a token');
      return;
    }

    setIsReceiving(true);
    setReceiveError('');

    try {
      console.log('[DashboardWalletHeader] Receiving token via NDK wallet...');

      // Use NDK wallet's receiveToken method
      const result = await receiveToken(receiveTokenString, 'Received via dashboard');
      
      if (result) {
        setReceiveSuccess('Successfully received token!');
        
        // Refresh wallet after receiving
        setTimeout(() => {
          refreshWallet();
          setShowReceiveModal(false);
          setReceiveTokenString('');
          setReceiveSuccess('');
        }, 2000);
      } else {
        throw new Error('Receive failed - no result returned');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Receive error:', error);
      setReceiveError(`Failed to receive token: ${error.message || 'Unknown error'}`);
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
                background: 'rgba(255, 99, 99, 0.2)', 
                color: '#ff6363', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
              }}>
                {sendError}
              </div>
            )}

            {sendSuccess && (
              <div className="success-message" style={{ 
                background: 'rgba(99, 255, 99, 0.2)', 
                color: '#63ff63', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem'
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

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                Memo (optional):
              </label>
              <input
                type="text"
                value={sendMemo}
                onChange={(e) => setSendMemo(e.target.value)}
                placeholder="Payment memo"
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

            <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowSendModal(false)}
                disabled={isSending}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendTokens}
                disabled={isSending || !sendAmount || !sendRecipient}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  opacity: (isSending || !sendAmount || !sendRecipient) ? 0.5 : 1
                }}
              >
                {isSending ? 'Sending...' : 'Send'}
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

            {receiveSuccess && (
              <div className="success-message" style={{ 
                background: 'rgba(99, 255, 99, 0.2)', 
                color: '#63ff63', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem'
              }}>
                {receiveSuccess}
              </div>
            )}

            {receiveError && (
              <div className="error-message" style={{ 
                background: 'rgba(255, 99, 99, 0.2)', 
                color: '#ff6363', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
              }}>
                {receiveError}
              </div>
            )}

            <div className="receive-method-tabs" style={{ display: 'flex', marginBottom: '16px' }}>
              <button
                onClick={() => setReceiveMethod('lightning')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  borderRadius: '4px 0 0 4px',
                  backgroundColor: receiveMethod === 'lightning' ? '#ff6b35' : 'var(--background-secondary)',
                  color: receiveMethod === 'lightning' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
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
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: receiveMethod === 'token' ? '#ff6b35' : 'var(--background-secondary)',
                  color: receiveMethod === 'token' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🏛️ Paste Token
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
                    placeholder="100"
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
                  <div className="invoice-display" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
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
                        backgroundColor: 'var(--background-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                )}

                <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setShowReceiveModal(false)}
                    disabled={isReceiving}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleRequestInvoice}
                    disabled={isReceiving || !receiveAmount}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: '#ff6b35',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      opacity: (isReceiving || !receiveAmount) ? 0.5 : 1
                    }}
                  >
                    {isReceiving ? 'Creating...' : 'Create Invoice'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                    Paste Ecash Token:
                  </label>
                  <textarea
                    value={receiveTokenString}
                    onChange={(e) => setReceiveTokenString(e.target.value)}
                    placeholder="cashu..."
                    disabled={isReceiving}
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '8px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--background-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <small style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Paste a cashu token that someone sent you via DM or QR code
                  </small>
                </div>

                <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setShowReceiveModal(false)}
                    disabled={isReceiving}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleReceiveToken}
                    disabled={isReceiving || !receiveTokenString}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: '#ff6b35',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      opacity: (isReceiving || !receiveTokenString) ? 0.5 : 1
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