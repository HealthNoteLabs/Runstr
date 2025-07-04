import React, { useState } from 'react';
import { useNWC } from '../contexts/NWCWalletContext';
import { getWalletAPI, getWalletInstance } from '../services/wallet/WalletPersistenceService';

export const WalletDebugger = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { 
    balance, 
    hasWallet: isConnected, 
    loading: contextLoading,
    error,
    isInitialized,
    walletAPI
  } = useNWC();

  const runFullDebug = async () => {
    setLoading(true);
    try {
      const walletInstance = getWalletInstance();
      const walletApi = getWalletAPI();
      
      const debugResult = {
        context: {
          balance,
          isConnected,
          contextLoading,
          error,
          isInitialized,
          hasWalletAPI: !!walletAPI
        },
        persistence: {
          hasWalletInstance: !!walletInstance,
          hasWalletApi: !!walletApi
        },
        localStorage: {
          nwcConnectionString: !!localStorage.getItem('nwcConnectionString'),
          nwcAuthUrl: !!localStorage.getItem('nwcAuthUrl'),
          connectionStringPreview: localStorage.getItem('nwcConnectionString')?.substring(0, 50) + '...'
        }
      };

      if (walletInstance && typeof walletInstance.debugWallet === 'function') {
        try {
          debugResult.walletCapabilities = await walletInstance.debugWallet();
        } catch (error) {
          debugResult.walletCapabilities = { error: error.message };
        }
      }

      setDebugInfo(debugResult);
    } catch (error) {
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '2px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
      <h3>Wallet Debugger</h3>
      <div style={{ marginBottom: '15px' }}>
        <h4>Current State</h4>
        <ul>
          <li>Connected: {isConnected ? 'Yes' : 'No'}</li>
          <li>Balance: {balance} sats</li>
          <li>Loading: {contextLoading ? 'Yes' : 'No'}</li>
          <li>Error: {error || 'None'}</li>
          <li>Initialized: {isInitialized ? 'Yes' : 'No'}</li>
        </ul>
      </div>
      <button onClick={runFullDebug} disabled={loading}>
        {loading ? 'Running Debug...' : 'Run Debug'}
      </button>
      {debugInfo && (
        <pre style={{ backgroundColor: '#000', color: '#0f0', padding: '10px', marginTop: '20px' }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      )}
    </div>
  );
}; 