import { useContext, useState, useEffect } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';
import { relays } from '../utils/nostrClient';

export default function Settings() {
  const { publicKey, requestNostrPermissions, isAmberAvailable } = useContext(NostrContext);
  const [diagnosticInfo, setDiagnosticInfo] = useState({
    amberInstalled: false,
    relayStatus: {},
    lastAuthAttempt: null
  });
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Check if Amber is installed
  useEffect(() => {
    const checkAmber = async () => {
      try {
        if (Platform.OS === 'android') {
          const installed = await AmberAuth.isAmberInstalled();
          setDiagnosticInfo(prev => ({ ...prev, amberInstalled: installed }));
        }
      } catch (error) {
        console.error('Error checking Amber:', error);
      }
    };
    
    checkAmber();
  }, []);

  // Authenticate with Nostr
  const handleAuthenticate = async () => {
    try {
      setDiagnosticInfo(prev => ({ 
        ...prev, 
        lastAuthAttempt: new Date().toISOString() 
      }));
      
      const result = await requestNostrPermissions();
      console.log('Authentication result:', result);
    } catch (error) {
      console.error('Error during authentication:', error);
    }
  };

  // Check relay connections
  const checkRelays = async () => {
    const results = {};
    
    for (const relay of relays) {
      try {
        // Create a simple WebSocket connection to test the relay
        const ws = new WebSocket(relay);
        
        // Set a timeout for the connection attempt
        const timeout = setTimeout(() => {
          ws.close();
          results[relay] = { status: 'timeout', error: 'Connection timeout' };
          
          if (Object.keys(results).length === relays.length) {
            setDiagnosticInfo(prev => ({ ...prev, relayStatus: results }));
          }
        }, 5000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          results[relay] = { status: 'connected' };
          ws.close();
          
          if (Object.keys(results).length === relays.length) {
            setDiagnosticInfo(prev => ({ ...prev, relayStatus: results }));
          }
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          results[relay] = { status: 'error', error: error.message || 'Unknown error' };
          
          if (Object.keys(results).length === relays.length) {
            setDiagnosticInfo(prev => ({ ...prev, relayStatus: results }));
          }
        };
      } catch (error) {
        results[relay] = { status: 'error', error: error.message };
        
        if (Object.keys(results).length === relays.length) {
          setDiagnosticInfo(prev => ({ ...prev, relayStatus: results }));
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-white">Settings</h1>
      
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Nostr Authentication</h2>
        
        <div className="mb-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${publicKey ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-gray-300">Status: {publicKey ? 'Connected' : 'Not Connected'}</span>
          </div>
          
          {publicKey && (
            <div className="mt-2 mb-4">
              <p className="text-gray-400 text-sm">Public Key:</p>
              <p className="text-sm text-gray-300 break-all bg-gray-900 p-2 rounded">{publicKey}</p>
            </div>
          )}
          
          {!publicKey && (
            <div className="mt-4">
              <button
                onClick={handleAuthenticate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
              >
                Connect with Amber
              </button>
              <p className="mt-2 text-xs text-gray-400">
                Connect your Nostr account to participate in run clubs and social features.
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Diagnostics Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Diagnostics</h2>
          <button 
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="text-blue-400 text-sm"
          >
            {showDiagnostics ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
        
        {showDiagnostics && (
          <div>
            <div className="mb-4">
              <h3 className="text-white text-lg mb-2">Amber Diagnostics</h3>
              <p className="text-gray-400">Amber Installed: <span className={diagnosticInfo.amberInstalled ? 'text-green-400' : 'text-red-400'}>
                {diagnosticInfo.amberInstalled ? 'Yes' : 'No'}
              </span></p>
              <p className="text-gray-400">Is Amber Available (context): <span className={isAmberAvailable ? 'text-green-400' : 'text-red-400'}>
                {isAmberAvailable ? 'Yes' : 'No'}
              </span></p>
              <p className="text-gray-400">Last Auth Attempt: <span className="text-blue-400">
                {diagnosticInfo.lastAuthAttempt || 'None'}
              </span></p>
            </div>
            
            <div className="mb-4">
              <h3 className="text-white text-lg mb-2">Relay Diagnostics</h3>
              <button
                onClick={checkRelays}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-2 rounded mb-2"
              >
                Check Relay Connections
              </button>
              
              {Object.keys(diagnosticInfo.relayStatus).length > 0 && (
                <div className="bg-gray-900 p-2 rounded text-sm">
                  {Object.entries(diagnosticInfo.relayStatus).map(([relay, status]) => (
                    <p key={relay} className="mb-1">
                      {relay}: <span className={status.status === 'connected' ? 'text-green-400' : 'text-red-400'}>
                        {status.status} {status.error ? `(${status.error})` : ''}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-white text-lg mb-2">System Info</h3>
              <p className="text-gray-400">Platform: {Platform.OS}</p>
              <p className="text-gray-400">React Native: {Platform.isReactNative ? 'Yes' : 'No'}</p>
              <p className="text-gray-400">WebSocket Available: {typeof WebSocket !== 'undefined' ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Other settings sections can go here */}
      
    </div>
  );
} 