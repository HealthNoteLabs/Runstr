import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNWC } from '../contexts/NWCWalletContext';
import { NostrContext } from '../contexts/NostrContext';

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
    refreshWallet,
    sendPayment,
    generateInvoice
  } = useNWC();

  // Add debugging
  console.log('[DashboardWalletHeader] Lightning Wallet State:', {
    hasWallet: isConnected,
    balance,
    loading,
    isInitialized,
    transactionCount: transactions?.length || 0,
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
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveInvoice, setReceiveInvoice] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveSuccess, setReceiveSuccess] = useState('');

  const handleSend = () => {
    if (!isConnected) {
      navigate('/nwc');
      return;
    }
    setShowSendModal(true);
  };

  const handleReceive = () => {
    if (!isConnected) {
      navigate('/nwc');
      return;
    }
    setShowReceiveModal(true);
  };

  const handleHistory = () => {
    navigate('/nwc');
  };

  // Handle sending Lightning payments
  const handleSendPayment = async () => {
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

    setIsSending(true);
    setSendError('');
    setSendSuccess('');

    try {
      console.log('[DashboardWalletHeader] Sending Lightning payment...');

      // Send Lightning payment using NWC
      const result = await sendPayment(sendRecipient, amount, sendMemo);
      
      if (result) {
        setSendSuccess(`Successfully sent ${amount} sats via Lightning!`);
        
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
        throw new Error('Lightning payment failed');
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
LIGHTNING PAYMENT ERROR:
Message: ${error?.message || 'No message'}
Type: ${typeof error}
Amount: ${amount || 'none'}
Recipient: ${sendRecipient?.substring(0, 50) || 'none'}...
Balance: ${balance || 0}
Connected: ${isConnected}
`;
      
      setSendError(`Failed to send Lightning payment: ${safeErrorMessage}\n\n${debugInfo}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle generating Lightning invoice for receiving
  const handleGenerateInvoice = async () => {
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
      console.log('[DashboardWalletHeader] Generating Lightning invoice...');

      // Generate Lightning invoice using NWC
      const invoice = await generateInvoice(amount, `RUNSTR payment request for ${amount} sats`);
      
      if (invoice) {
        setReceiveInvoice(invoice);
        setReceiveSuccess(`Invoice created for ${amount} sats`);
      } else {
        throw new Error('Failed to generate Lightning invoice');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Invoice error:', error);
      
      // Create detailed error information for mobile debugging
      const errorDetails = {
        message: error?.message || 'No message',
        type: typeof error,
        isError: error instanceof Error,
        keys: error ? Object.keys(error) : [],
        string: error?.toString?.() || 'Cannot convert to string'
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
INVOICE GENERATION ERROR:
Message: ${errorDetails.message}
Type: ${errorDetails.type}
Is Error Object: ${errorDetails.isError}
Object Keys: ${errorDetails.keys.join(', ')}
String Conversion: ${errorDetails.string}

CONTEXT:
Amount: ${amount}
Connected: ${isConnected}
`;
      
      setReceiveError(`Failed to create invoice: ${safeErrorMessage}\n\n${debugInfo}`);
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
              {loading ? 'Checking Lightning wallet...' : 
               'Lightning Wallet Not Connected'}
            </span>
          </div>
          <button 
            className="connect-button"
            onClick={() => navigate('/nwc')}
            disabled={loading}
          >
            {loading ? '...' : 'Connect Lightning Wallet'}
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
            <h3>Send Lightning Payment</h3>
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
                Recipient (Lightning invoice):
              </label>
              <input
                type="text"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder="lnbc... (Lightning invoice)"
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
                placeholder="Payment description..."
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

            <div className="modal-actions">
              <button 
                onClick={() => setShowSendModal(false)}
                disabled={isSending}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  marginRight: '8px'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendPayment}
                disabled={isSending || !sendAmount || !sendRecipient}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: isSending ? '#666' : '#ff6b35',
                  color: 'white',
                  cursor: isSending ? 'not-allowed' : 'pointer'
                }}
              >
                {isSending ? 'Sending...' : 'Send Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Generate Lightning Invoice</h3>
            
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

            {!receiveInvoice ? (
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

                <div className="modal-actions">
                  <button 
                    onClick={() => setShowReceiveModal(false)}
                    disabled={isReceiving}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--background-secondary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGenerateInvoice}
                    disabled={isReceiving || !receiveAmount}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: isReceiving ? '#666' : '#28a745',
                      color: 'white',
                      cursor: isReceiving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isReceiving ? 'Generating...' : 'Generate Invoice'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="invoice-display" style={{ 
                  background: 'var(--background-secondary)', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '12px',
                  wordBreak: 'break-all',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace'
                }}>
                  {receiveInvoice}
                </div>
                
                <div className="modal-actions">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(receiveInvoice);
                      setReceiveSuccess('Invoice copied to clipboard!');
                    }}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Copy Invoice
                  </button>
                  <button 
                    onClick={() => {
                      setShowReceiveModal(false);
                      setReceiveInvoice('');
                      setReceiveAmount('');
                      setReceiveSuccess('');
                    }}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--background-secondary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    Close
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