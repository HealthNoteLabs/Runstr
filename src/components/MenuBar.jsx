import { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FloatingMusicPlayer } from './FloatingMusicPlayer';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import rewardsPayoutService from '../services/rewardsPayoutService';
import { NostrContext } from '../contexts/NostrContext';
import { 
  connectWallet, 
  softDisconnectWallet, 
  checkWalletConnection as checkWalletConnectionService,
  getWalletAPI,
  subscribeToConnectionChanges,
  CONNECTION_STATES,
  getConnectionState
} from '../services/wallet/WalletPersistenceService';

export const MenuBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateDefaultZapAmount, defaultZapAmount } = useContext(NostrContext);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, getActivityText } = useActivityMode();
  const { 
    distanceUnit, toggleDistanceUnit,
    healthEncryptionPref, setHealthEncryptionPref,
    publishMode, setPublishMode,
    privateRelayUrl, setPrivateRelayUrl
  } = useSettings();
  const [userHeight, setUserHeight] = useState('');
  const [customStrideLength, setCustomStrideLength] = useState('');
  const [nwcUrl, setNwcUrl] = useState('');
  const [nwcConnecting, setNwcConnecting] = useState(false);
  const [nwcError, setNwcError] = useState('');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [lastConnectionCheck, setLastConnectionCheck] = useState(null);

  useEffect(() => {
    // Check initial wallet connection state
    const checkInitialState = async () => {
      const connectionState = getConnectionState();
      setIsWalletConnected(connectionState === CONNECTION_STATES.CONNECTED);
      setLastConnectionCheck(new Date());
    };
    checkInitialState();

    // Subscribe to wallet connection changes
    const unsubscribe = subscribeToConnectionChanges((state) => {
      setIsWalletConnected(state === CONNECTION_STATES.CONNECTED);
      setLastConnectionCheck(new Date());
    });

    // Load saved height and stride settings
    const savedHeight = localStorage.getItem('userHeight') || '';
    const savedStride = localStorage.getItem('customStrideLength') || '';
    setUserHeight(savedHeight);
    setCustomStrideLength(savedStride);

    return () => unsubscribe();
  }, []);

  const handleNWCConnect = async () => {
    if (!nwcUrl.trim()) return;
    
    setNwcConnecting(true);
    setNwcError('');
    
    try {
      const connected = await connectWallet(nwcUrl.trim());
      if (connected) {
        console.log('[MenuBar] NWC wallet connected successfully');
        setNwcUrl(''); // Clear the input
        alert('Wallet connected successfully! ⚡️');
      } else {
        setNwcError('Failed to connect wallet');
      }
    } catch (err) {
      console.error('[MenuBar] NWC connection error:', err);
      setNwcError(err.message || 'Failed to connect wallet');
    } finally {
      setNwcConnecting(false);
    }
  };

  const handleNWCDisconnect = async () => {
    try {
      await softDisconnectWallet();
      setIsWalletConnected(false);
      alert('Wallet disconnected');
    } catch (err) {
      console.error('[MenuBar] Error disconnecting wallet:', err);
    }
  };

  const menuItems = [
    { 
      name: 'DASHBOARD', 
      path: '/', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ) 
    },
    { 
      name: 'STATS', 
      path: '/history', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ) 
    },
    { 
      name: 'FEED', 
      path: '/club', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ) 
    },
    { 
      name: 'TEAMS', 
      path: '/teams', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ) 
    },
    { 
      name: 'MUSIC', 
      path: '/music', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ) 
    }
  ];

  const toggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

  const handleActivityModeChange = (newMode) => {
    setMode(newMode);
  };

  const handleHealthEncryptionToggle = async (e) => {
    const enable = e.target.checked;
    if (!enable) {
      const confirmDisable = window.confirm(
        'Publishing health data unencrypted will make the values publicly visible on relays. Are you sure you want to disable encryption?'
      );
      if (!confirmDisable) {
        e.preventDefault();
        return;
      }
    }
    setHealthEncryptionPref(enable ? 'encrypted' : 'plaintext');
  };

  return (
    <div className="w-full">
      {/* Header with Settings */}
      <header className="flex justify-between items-center p-4 w-full">
        <Link to="/" className="text-xl font-bold">#RUNSTR</Link>
        <div className="min-w-[120px]">
          <FloatingMusicPlayer />
        </div>
        <button className="text-gray-400" onClick={toggleSettings}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black bg-opacity-70">
          <div className="bg-[#1a222e] rounded-t-xl sm:rounded-xl w-full max-w-md p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Settings</h3>
              <button onClick={toggleSettings} className="text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Activity Types Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Activity Types</h4>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.RUN ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.RUN)}
                >
                  Run
                </button>
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.WALK ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.WALK)}
                >
                  Walk
                </button>
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.CYCLE ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.CYCLE)}
                >
                  Cycle
                </button>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Currently tracking: {getActivityText()}
              </p>
            </div>
            
            {/* Distance Unit Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Distance Units</h4>
              <div className="flex justify-center mb-2">
                <div className="flex rounded-full bg-[#111827] p-1">
                  <button 
                    className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'km' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                    onClick={() => distanceUnit !== 'km' && toggleDistanceUnit()}
                  >
                    Kilometers
                  </button>
                  <button 
                    className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'mi' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                    onClick={() => distanceUnit !== 'mi' && toggleDistanceUnit()}
                  >
                    Miles
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                All distances will be shown in {distanceUnit === 'km' ? 'kilometers' : 'miles'} throughout the app
              </p>
            </div>
            
            {/* Health Encryption Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Health Data Privacy</h4>
              <div className="flex items-center justify-between bg-[#111827] p-3 rounded-lg mb-3">
                <span className="text-sm text-gray-400 mr-3">Encrypt Health Data (NIP-44)</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="encryptionToggleModal"
                    checked={healthEncryptionPref === 'encrypted'}
                    onChange={handleHealthEncryptionToggle}
                  />
                  <span className="toggle-slider"></span>
                </div>
              </div>

              {/* Publish Destination Section - ADDED HERE */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Publish Destination</label>
                <div className="flex rounded-md bg-[#111827] p-1 space-x-1">
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md ${
                      publishMode === 'public' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    onClick={() => setPublishMode('public')}
                  >
                    Public Relays
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md ${
                      publishMode === 'private' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    onClick={() => setPublishMode('private')}
                  >
                    Private Relay
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md ${
                      publishMode === 'mixed' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    onClick={() => setPublishMode('mixed')}
                  >
                    Mixed
                  </button>
                </div>
                {(publishMode === 'private' || publishMode === 'mixed') && (
                  <div className="mt-2">
                    <label htmlFor="privateRelayUrlInputModal" className="block text-xs font-medium text-gray-400 mb-1">
                      Private Relay URL (wss://...)
                    </label>
                    <input
                      id="privateRelayUrlInputModal"
                      type="text"
                      value={privateRelayUrl}
                      onChange={e => setPrivateRelayUrl(e.target.value)}
                      placeholder="wss://your-private-relay.com"
                      className="w-full bg-[#0b101a] p-2 rounded-md text-white text-sm border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Bitcoin Rewards Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Bitcoin Rewards</h4>
              {/*
              <div className="space-y-2">
                <label htmlFor="lnAddressInput" className="text-sm text-gray-400">Lightning Address (to receive streak rewards)</label>
                <div className="flex">
                  <input
                    id="lnAddressInput"
                    type="text"
                    defaultValue={localStorage.getItem('lightningAddress') || ''}
                    placeholder="you@getalby.com"
                    className="flex-1 bg-[#111827] p-2 rounded-l-lg text-white text-sm"
                  />
                  <button
                    className="bg-indigo-600 px-4 rounded-r-lg text-white text-sm"
                    onClick={() => {
                      const val = document.getElementById('lnAddressInput').value.trim();
                      if (val && val.includes('@')) {
                        localStorage.setItem('lightningAddress', val);
                        localStorage.setItem('runstr_lightning_addr', val);
                        alert('Lightning address saved!');
                      } else {
                        alert('Enter a valid Lightning address e.g. name@domain.com');
                      }
                    }}
                  >Save</button>
                </div>
                <p className="text-xs text-gray-500">If you also connect an NWC wallet, the app will pay that first and fall back to this address if needed.</p>
              </div>
              */}
              <p className="text-sm text-gray-400">
                Runstr now automatically sends Bitcoin rewards directly to your connected Nostr account (via Zaps).
                You no longer need to configure a separate Lightning Address here. Ensure your Nostr profile has a Lightning Address set up to receive rewards.
              </p>
              {/* End of debug section – TEST PAYOUT button removed for production */}
            </div>
            
            {/* NWC Wallet Connection Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Lightning Wallet (NWC)</h4>
              {!isWalletConnected ? (
                <div className="space-y-2">
                  <label htmlFor="nwcInput" className="text-sm text-gray-400">
                    Connect your Lightning wallet for zaps
                  </label>
                  <div className="flex">
                    <input
                      id="nwcInput"
                      type="text"
                      value={nwcUrl}
                      onChange={(e) => setNwcUrl(e.target.value)}
                      placeholder="nostr+walletconnect://..."
                      className="flex-1 bg-[#111827] p-2 rounded-l-lg text-white text-sm"
                      disabled={nwcConnecting}
                    />
                    <button
                      onClick={handleNWCConnect}
                      disabled={nwcConnecting || !nwcUrl.trim()}
                      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-r-lg text-sm disabled:opacity-50"
                    >
                      {nwcConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  </div>
                  {nwcError && (
                    <p className="text-red-500 text-xs">{nwcError}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Get your NWC connection string from your Lightning wallet app
                  </p>
                  <div className="mt-2">
                    <button
                      onClick={async () => {
                        const authUrl = prompt("Enter wallet authorization URL (starts with https://)", "https://");
                        if (authUrl && authUrl.startsWith('https://')) {
                          setNwcConnecting(true);
                          setNwcError('');
                          try {
                            const connected = await connectWallet(authUrl);
                            if (connected) {
                              console.log('[MenuBar] Wallet connected via auth URL');
                              alert('Wallet connected successfully! ⚡️');
                            } else {
                              setNwcError('Failed to connect with authorization URL');
                            }
                          } catch (err) {
                            console.error('[MenuBar] Auth URL connection error:', err);
                            setNwcError(err.message || 'Failed to connect with authorization URL');
                          } finally {
                            setNwcConnecting(false);
                          }
                        } else if (authUrl) {
                          setNwcError('Invalid authorization URL. Must start with https://');
                        }
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      Or use authorization URL
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-green-500 text-sm">✅ Wallet connected</p>
                  {lastConnectionCheck && (
                    <p className="text-xs text-gray-500">
                      Last checked: {lastConnectionCheck.toLocaleTimeString()}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const isConnected = await checkWalletConnectionService();
                          setIsWalletConnected(isConnected);
                          setLastConnectionCheck(new Date());
                          if (isConnected) {
                            alert('Wallet connection is active ✅');
                          } else {
                            alert('Wallet connection lost. Attempting to reconnect...');
                            const walletAPI = getWalletAPI();
                            const reconnected = await walletAPI.ensureConnected();
                            if (reconnected) {
                              setIsWalletConnected(true);
                              alert('Wallet reconnected successfully! ⚡️');
                            } else {
                              alert('Failed to reconnect. Please reconnect manually.');
                            }
                          }
                        } catch (err) {
                          console.error('[MenuBar] Error checking connection:', err);
                          alert('Error checking connection: ' + err.message);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
                    >
                      Check Connection
                    </button>
                    <button
                      onClick={handleNWCDisconnect}
                      className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Step Counting Settings Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Step Counting (Walking)</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="userHeightInput" className="text-sm text-gray-400 block mb-1">
                    Your Height (cm) - Used to estimate stride length
                  </label>
                  <div className="flex">
                    <input
                      id="userHeightInput"
                      type="number"
                      min="100"
                      max="250"
                      defaultValue={localStorage.getItem('userHeight') || ''}
                      placeholder="170"
                      className="flex-1 bg-[#111827] p-2 rounded-l-lg text-white text-sm"
                    />
                    <button
                      className="bg-indigo-600 px-4 rounded-r-lg text-white text-sm"
                      onClick={() => {
                        const val = document.getElementById('userHeightInput').value.trim();
                        const height = parseFloat(val);
                        if (height && height >= 100 && height <= 250) {
                          localStorage.setItem('userHeight', val);
                          // Clear custom stride length when height is set
                          localStorage.removeItem('customStrideLength');
                          alert('Height saved! Step counting will now use your height to estimate stride length.');
                        } else {
                          alert('Please enter a valid height between 100 and 250 cm');
                        }
                      }}
                    >Save</button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to use average stride length</p>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#1a222e] text-gray-400">OR</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="strideInput" className="text-sm text-gray-400 block mb-1">
                    Custom Stride Length (meters) - For more accurate step counting
                  </label>
                  <div className="flex">
                    <input
                      id="strideInput"
                      type="number"
                      min="0.4"
                      max="1.5"
                      step="0.01"
                      defaultValue={localStorage.getItem('customStrideLength') || ''}
                      placeholder="0.76"
                      className="flex-1 bg-[#111827] p-2 rounded-l-lg text-white text-sm"
                    />
                    <button
                      className="bg-indigo-600 px-4 rounded-r-lg text-white text-sm"
                      onClick={() => {
                        const val = document.getElementById('strideInput').value.trim();
                        const stride = parseFloat(val);
                        if (stride && stride >= 0.4 && stride <= 1.5) {
                          localStorage.setItem('customStrideLength', val);
                          // Clear height when custom stride is set
                          localStorage.removeItem('userHeight');
                          alert('Custom stride length saved!');
                        } else {
                          alert('Please enter a valid stride length between 0.4 and 1.5 meters');
                        }
                      }}
                    >Save</button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Average: 0.76m (men), 0.66m (women)</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-4">
              <Link 
                to="/nwc" 
                className="flex items-center p-3 bg-[#111827] rounded-lg text-white"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Wallet</span>
              </Link>
              <Link 
                to="/about" 
                className="flex items-center p-3 bg-[#111827] rounded-lg text-white"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>About Runstr</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0a1525] py-2 z-40">
        <div className="max-w-[500px] mx-auto px-2">
          <ul className="flex justify-between">
            {menuItems.map((item) => (
              <li key={item.name} className="flex-1">
                <Link 
                  to={item.path} 
                  className={`flex flex-col items-center justify-center px-1 py-1 rounded-md h-full ${location.pathname === item.path ? 'text-indigo-400' : 'text-gray-400'}`}
                >
                  {item.icon}
                  <span className="text-xs font-medium tracking-wider text-center whitespace-nowrap">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
};
