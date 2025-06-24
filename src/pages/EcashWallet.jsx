import { useState } from 'react';
import { useNDKWallet } from '../contexts/NDKWalletContext';
import '../assets/styles/ecashWallet.css';

export const EcashWallet = () => {
  const {
    loading,
    error,
    status,
    balance,
    wallet,
    initializeWallet,
    refreshBalance,
    refreshNutzaps,
    retryInitialization,
    resetWallet,
    DEFAULT_MINT_URL,
    SUPPORTED_MINTS,
    needsSignerApproval,
    canRetry,
    partialMode,
    retryCount,
    activeMint,
    failedMints,
    lastNutzapRefresh
  } = useNDKWallet();

  const [isInitializing, setIsInitializing] = useState(false);
  const [isRefreshingNutzaps, setIsRefreshingNutzaps] = useState(false);
  const [nutzapRefreshResult, setNutzapRefreshResult] = useState(null);

  // Derived state to match old interface
  const hasWallet = status === 'ready' && wallet;
  const currentMint = activeMint || { url: DEFAULT_MINT_URL, name: 'CoinOS' };
  const refreshWallet = refreshBalance;
  
  // Since NDK manages token events internally, we'll show wallet info differently
  const transactionCount = balance?.amount > 0 ? 1 : 0; // Simplified for now

  const handleInitializeWallet = async () => {
    setIsInitializing(true);
    try {
      console.log('[EcashWallet] User requested wallet initialization...');
      await initializeWallet(); // No parameters needed
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      // Error is handled by the context
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRetryInitialization = async () => {
    setIsInitializing(true);
    try {
      console.log('[EcashWallet] User requested wallet retry...');
      await retryInitialization();
    } catch (error) {
      console.error('Failed to retry wallet initialization:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleResetWallet = async () => {
    if (window.confirm('Are you sure you want to reset your wallet? This will clear all cached data and you\'ll need to initialize again.')) {
      await resetWallet();
    }
  };

  const handleRefreshNutzaps = async () => {
    setIsRefreshingNutzaps(true);
    setNutzapRefreshResult(null);
    
    try {
      console.log('[EcashWallet] User requested manual nutzap refresh...');
      const result = await refreshNutzaps();
      setNutzapRefreshResult(result);
      
      // Clear result after 5 seconds
      setTimeout(() => setNutzapRefreshResult(null), 5000);
    } catch (error) {
      console.error('Failed to refresh nutzaps:', error);
      setNutzapRefreshResult({ 
        success: false, 
        message: `Failed to refresh nutzaps: ${error.message}` 
      });
    } finally {
      setIsRefreshingNutzaps(false);
    }
  };

  if (loading) {
    return (
      <div className="ecash-wallet-page">
        <div className="loading-state">
          <h2>🔍 {status === 'discovering' ? 'Checking for Wallet...' : 
                 status === 'creating' ? 'Creating Wallet...' :
                 status === 'publishing' ? 'Publishing Wallet...' : 
                 'Loading Wallet...'}</h2>
          <p>{status === 'discovering' ? 'Looking for your existing wallet (no signing required)...' :
              status === 'creating' ? 'Setting up your new wallet...' :
              status === 'publishing' ? 'Publishing wallet metadata - check Amber for signing requests...' :
              'Initializing wallet...'}</p>
          <div className="loading-spinner">⏳</div>
          
          {retryCount > 0 && (
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
              Retry attempt {retryCount}...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ecash-wallet-page">
        <div className="error-state">
          <h2>❌ Wallet Error</h2>
          <p>{error}</p>
          
          {/* Show failed mints if any */}
          {failedMints.length > 0 && (
            <div style={{ 
              background: 'rgba(255, 99, 99, 0.1)', 
              padding: '12px', 
              borderRadius: '8px', 
              margin: '12px 0',
              fontSize: '0.9rem'
            }}>
              <strong>Failed Mints:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {failedMints.map(mint => (
                  <li key={mint.url}>{mint.name} ({mint.url})</li>
                ))}
              </ul>
            </div>
          )}

          {/* Enhanced error handling with multiple options */}
          <div className="error-actions" style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap',
            marginTop: '16px'
          }}>
            {canRetry && (
              <button 
                onClick={handleRetryInitialization} 
                disabled={isInitializing}
                className="retry-button"
                style={{ 
                  background: 'var(--primary-color)', 
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {isInitializing ? '🔄 Retrying...' : '🔄 Try Again'}
              </button>
            )}
            
            <button 
              onClick={refreshWallet} 
              disabled={loading}
              className="refresh-button"
              style={{ 
                background: 'var(--secondary-color, #666)', 
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
            </button>
            
            <button 
              onClick={handleResetWallet}
              className="reset-button"
              style={{ 
                background: '#ff6b6b', 
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              🔄 Reset Wallet
            </button>
          </div>

          {needsSignerApproval && (
            <div style={{ 
              background: 'rgba(255, 193, 7, 0.2)', 
              color: '#ff6b00', 
              padding: '12px', 
              borderRadius: '8px', 
              margin: '16px 0',
              textAlign: 'center'
            }}>
              💡 <strong>Tip:</strong> Make sure to approve signing requests in Amber
            </div>
          )}

          {partialMode && (
            <div style={{ 
              background: 'rgba(255, 193, 7, 0.2)', 
              padding: '12px', 
              borderRadius: '8px', 
              margin: '16px 0'
            }}>
              <h4>⚠️ Partial Mode Available</h4>
              <p>Some wallet features are available in limited mode. You can view balance and retry full initialization.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!hasWallet && !partialMode) {
    return (
      <div className="ecash-wallet-page">
        <div className="wallet-creation">
          <h2>🚀 Initialize Your Wallet</h2>
          <p>No existing wallet found. Initialize your wallet to start receiving and sending sats.</p>
          
          <div className="wallet-setup-info">
            <div className="setup-step">
              <h3>What happens when you initialize:</h3>
              <ul>
                <li>📱 Your wallet will be created securely using your Nostr identity</li>
                <li>🔒 Default mint: {currentMint.name} (trusted and reliable)</li>
                <li>⚡ Zero starting balance - ready to receive sats</li>
                <li>⚙️ Fallback mints available if primary fails</li>
              </ul>
            </div>

            {/* Show available mints */}
            <div className="available-mints" style={{ 
              background: 'rgba(0, 255, 0, 0.1)', 
              padding: '12px', 
              borderRadius: '8px', 
              margin: '12px 0' 
            }}>
              <h4>📡 Available Mints:</h4>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {SUPPORTED_MINTS.map(mint => (
                  <li key={mint.url} style={{ 
                    color: failedMints.some(f => f.url === mint.url) ? '#ff6b6b' : 'inherit' 
                  }}>
                    {mint.name} - Priority {mint.priority}
                    {failedMints.some(f => f.url === mint.url) && ' (Failed)'}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {error && (
            <div className="error-message" style={{ 
              background: 'rgba(255, 99, 99, 0.2)', 
              color: '#ff6363', 
              padding: '12px', 
              borderRadius: '8px', 
              margin: '16px 0',
              textAlign: 'center'
            }}>
              {error}
              {needsSignerApproval && (
                <div style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                  💡 <strong>Tip:</strong> Make sure to approve signing requests in Amber
                </div>
              )}
            </div>
          )}

          <button 
            onClick={handleInitializeWallet}
            disabled={isInitializing}
            className="create-wallet-btn"
          >
            {isInitializing ? '🔐 Requesting Amber Signature...' : '🚀 Initialize Wallet'}
          </button>
          
          {(isInitializing || status === 'publishing') && (
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.9rem', 
              marginTop: '12px',
              textAlign: 'center'
            }}>
              📱 Check Amber for signing prompts. You'll need to approve 2 signatures to initialize your wallet.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ecash-wallet-page">
      <div className="wallet-header">
        <h2>💰 Your Wallet</h2>
        <div className="wallet-info">
          <div className="balance-display">
            <span className="balance-label">Balance:</span>
            <span className="balance-amount">{balance} sats</span>
          </div>
          <div className="mint-info">
            <span className="mint-label">Provider:</span>
            <span className="mint-name">{currentMint?.name || 'Unknown'}</span>
          </div>
        </div>
        <div className="wallet-description">
          <p>Secure wallet powered by NDK. Status: {status}{partialMode && ' (Partial Mode)'}</p>
        </div>
      </div>

      <div className="wallet-actions">
        <button onClick={refreshWallet} disabled={loading} className="refresh-button">
          {loading ? '⏳ Refreshing...' : '🔄 Refresh Balance'}
        </button>
        
        {/* Manual nutzap refresh button */}
        <button 
          onClick={handleRefreshNutzaps} 
          disabled={isRefreshingNutzaps}
          className="nutzap-refresh-button"
          style={{ 
            background: '#9b59b6', 
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            marginLeft: '8px'
          }}
        >
          {isRefreshingNutzaps ? '⏳ Checking...' : '🔄 Check for Nutzaps'}
        </button>

        {partialMode && (
          <button 
            onClick={handleRetryInitialization}
            disabled={isInitializing}
            className="retry-full-button"
            style={{ 
              background: '#27ae60', 
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            {isInitializing ? '⏳ Retrying...' : '🔄 Retry Full Mode'}
          </button>
        )}
      </div>

      {/* Nutzap refresh result */}
      {nutzapRefreshResult && (
        <div style={{ 
          background: nutzapRefreshResult.success ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
          color: nutzapRefreshResult.success ? '#27ae60' : '#e74c3c',
          padding: '12px',
          borderRadius: '6px',
          margin: '12px 0',
          textAlign: 'center'
        }}>
          <strong>{nutzapRefreshResult.success ? '✅' : '❌'} {nutzapRefreshResult.message}</strong>
          {nutzapRefreshResult.retriedCount > 0 && (
            <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
              Processed {nutzapRefreshResult.retriedCount} nutzap(s)
            </div>
          )}
        </div>
      )}

      {/* Last refresh timestamp */}
      {lastNutzapRefresh && (
        <div style={{ 
          fontSize: '0.8rem', 
          color: 'var(--text-secondary)', 
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          Last nutzap check: {new Date(lastNutzapRefresh).toLocaleTimeString()}
        </div>
      )}

      <div className="wallet-features">
        <h3>✨ Wallet Features</h3>
        <div className="feature-list">
          <div className="feature-item">
            <span className="feature-icon">🔐</span>
            <div className="feature-details">
              <h4>Automatic Nutzap Reception</h4>
              <p>Your wallet is configured to automatically receive nutzaps (NIP-61). Use the "Check for Nutzaps" button to manually retry failed ones.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📡</span>
            <div className="feature-details">
              <h4>Nostr Integration</h4>
              <p>Fully integrated with Nostr using your existing identity</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <div className="feature-details">
              <h4>Lightning Support</h4>
              <p>Create invoices and receive payments via Lightning Network</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🏪</span>
            <div className="feature-details">
              <h4>Multi-Mint Support</h4>
              <p>Connected to {currentMint?.name} with fallback to {SUPPORTED_MINTS.length - 1} other mints</p>
            </div>
          </div>
          {partialMode && (
            <div className="feature-item">
              <span className="feature-icon">⚠️</span>
              <div className="feature-details">
                <h4>Partial Mode Active</h4>
                <p>Some features may be limited. Try "Retry Full Mode" to restore full functionality.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="debug-info">
        <details>
          <summary>🔧 Technical Details</summary>
          <pre>{JSON.stringify({ 
            hasWallet, 
            balance,
            status,
            provider: currentMint?.name,
            walletStatus: hasWallet ? 'initialized' : 'not initialized',
            providerStatus: currentMint ? 'connected' : 'none',
            needsSignerApproval,
            partialMode,
            retryCount,
            activeMint: activeMint?.name,
            failedMints: failedMints.map(m => m.name),
            supportedMints: SUPPORTED_MINTS.length,
            lastNutzapRefresh
          }, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}; 