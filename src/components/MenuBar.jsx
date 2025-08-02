import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FloatingMusicPlayer } from './FloatingMusicPlayer';
import { ActivityModeBanner } from './ActivityModeBanner';
// import { DashboardWalletHeader } from './DashboardWalletHeader'; // Temporarily disabled - ecash wallet under development
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import rewardsPayoutService from '../services/rewardsPayoutService';
import { testConnection, DEFAULT_SERVERS } from '../lib/blossom';
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import './MenuBar.css';

export const MenuBar = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, getActivityText } = useActivityMode();
  const { 
    distanceUnit, toggleDistanceUnit,
    healthEncryptionPref, setHealthEncryptionPref,
    publishMode, setPublishMode,
    privateRelayUrl, setPrivateRelayUrl,
    blossomEndpoint, setBlossomEndpoint,
    skipStartCountdown, setSkipStartCountdown,
    usePedometer, setUsePedometer,
    useLocalStats, setUseLocalStats,
    autoPostToNostr, setAutoPostToNostr,
    autoPostKind1Note, setAutoPostKind1Note
  } = useSettings();

  // State for the fallback lightning address in the modal - COMMENTED OUT (moving to manual weekly rewards)
  // const [manualLnAddress, setManualLnAddress] = useState('');
  // const [lnAddressStatusMessage, setLnAddressStatusMessage] = useState('');
  
  // Blossom connection test state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [customBlossomUrl, setCustomBlossomUrl] = useState('');

  // Load manualLnAddress when settings modal becomes visible or component mounts - COMMENTED OUT (moving to manual weekly rewards)
  // useEffect(() => {
  //   // Only load if the modal might be opened, or simply on mount.
  //   // If settingsOpen state is not directly accessible here, loading on mount is fine.
  //   const savedLnAddress = localStorage.getItem('manualLightningAddress');
  //   if (savedLnAddress) {
  //     setManualLnAddress(savedLnAddress);
  //   }
  // }, []); // Empty dependency array: runs once on mount.
           // Or, if settingsOpen is available: [settingsOpen] to run when modal visibility changes

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
      name: 'PROFILE', 
      path: useLocalStats ? '/history' : '/nostr-stats', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ) 
    },
    { 
      name: 'LEAGUE', 
      path: '/club', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21h6M12 15v6M8 6h8l-1-3H9l-1 3zM7 6v5a5 5 0 0010 0V6" />
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
      name: 'EVENTS', 
      path: '/events', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

  // COMMENTED OUT - Moving to manual weekly rewards, no longer need lightning address input
  // const handleSaveLnAddress = () => {
  //   if (manualLnAddress && manualLnAddress.includes('@') && manualLnAddress.includes('.')) {
  //     localStorage.setItem('manualLightningAddress', manualLnAddress);
  //     setLnAddressStatusMessage('Lightning Address saved!');
  //   } else if (!manualLnAddress) {
  //     localStorage.removeItem('manualLightningAddress');
  //     setLnAddressStatusMessage('Lightning Address cleared.');
  //   } else {
  //     setLnAddressStatusMessage('Please enter a valid Lightning Address (e.g., user@domain.com)');
  //   }
  //   setTimeout(() => setLnAddressStatusMessage(''), 3000);
  // };

  const handleTestBlossomConnection = async () => {
    // Determine the actual URL to test
    const urlToTest = blossomEndpoint === 'custom' ? customBlossomUrl : blossomEndpoint;
    
    if (!urlToTest) {
      setConnectionStatus({ success: false, message: 'Please enter a Blossom server URL first' });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const isConnected = await testConnection(urlToTest);
      if (isConnected) {
        setConnectionStatus({ 
          success: true, 
          message: 'Successfully connected to Blossom server!' 
        });
      } else {
        setConnectionStatus({ 
          success: false, 
          message: 'Could not connect to Blossom server. Please check the URL.' 
        });
      }
    } catch (error) {
      setConnectionStatus({ 
        success: false, 
        message: `Connection failed: ${error.message}` 
      });
    } finally {
      setIsTestingConnection(false);
      // Clear status after 5 seconds
      setTimeout(() => setConnectionStatus(null), 5000);
    }
  };

  return (
    <div className="w-full">
      {/* Header with Music Player and Settings */}
      <header className="p-4 w-full">
        {/* Music Player (top right) */}
        <div className="flex justify-end mb-3">
          <div className="min-w-[120px]">
            <FloatingMusicPlayer />
          </div>
        </div>
        
        {/* Activity Mode Banner */}
        <ActivityModeBanner onSettingsClick={toggleSettings} />
      </header>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black bg-opacity-70">
          <div className="bg-bg-secondary rounded-t-xl sm:rounded-xl w-full max-w-md p-6 shadow-lg max-h-[90vh] overflow-y-auto border border-border-secondary">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-heading">Settings</h3>
              <button onClick={toggleSettings} className="text-text-secondary hover:text-text-primary transition-colors duration-normal">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Activity Types Section */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Activity Types</h4>
              <ButtonGroup
                value={mode}
                onValueChange={handleActivityModeChange}
                options={[
                  { value: ACTIVITY_TYPES.RUN, label: 'Run' },
                  { value: ACTIVITY_TYPES.WALK, label: 'Walk' },
                  { value: ACTIVITY_TYPES.CYCLE, label: 'Cycle' }
                ]}
                size="default"
                className="mb-2"
              />
              <p className="text-sm text-text-secondary mt-2">
                Currently tracking: {getActivityText()}
              </p>
            </div>
            
            {/* Run Behavior Section - NEW */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Run Behavior</h4>
              <div className="bg-bg-tertiary p-3 rounded-lg space-y-3 border border-border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary mr-3">Skip Start Countdown</span>
                  <input 
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                    checked={skipStartCountdown}
                    onChange={() => setSkipStartCountdown(!skipStartCountdown)}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Start the run immediately when you tap "Start Run".
                </p>
              </div>
            </div>
            
            {/* Stats Settings Section - NEW */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Stats Settings</h4>
              <div className="bg-bg-tertiary p-3 rounded-lg space-y-3 border border-border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary mr-3">Use Local Stats</span>
                  <input 
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                    checked={useLocalStats}
                    onChange={() => setUseLocalStats(!useLocalStats)}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  When enabled, the Stats tab shows local run history instead of Nostr workout stats.
                </p>
              </div>
            </div>
            
            {/* Nostr Publishing Section */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Nostr Publishing</h4>
              <div className="bg-bg-tertiary p-3 rounded-lg space-y-3 border border-border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary mr-3">Auto-publish runs to Nostr</span>
                  <input 
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                    checked={autoPostToNostr}
                    onChange={() => setAutoPostToNostr(!autoPostToNostr)}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Automatically publish completed runs to Nostr with your team/challenge associations. You can still manually publish from the dashboard if disabled.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary mr-3">Auto-post Run Notes to Nostr</span>
                  <input 
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                    checked={autoPostKind1Note}
                    onChange={() => setAutoPostKind1Note(!autoPostKind1Note)}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Automatically opens a posting modal for sharing run notes after workout data is posted.
                </p>
              </div>
            </div>
            
            {/* Distance Unit Section */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Distance Units</h4>
              <ButtonGroup
                value={distanceUnit}
                onValueChange={(newUnit) => {
                  if (newUnit !== distanceUnit) {
                    toggleDistanceUnit();
                  }
                }}
                options={[
                  { value: 'km', label: 'Kilometers' },
                  { value: 'mi', label: 'Miles' }
                ]}
                size="default"
                className="mb-2"
              />
              <p className="text-sm text-text-secondary mt-2">
                All distances will be shown in {distanceUnit === 'km' ? 'kilometers' : 'miles'} throughout the app
              </p>
            </div>
            
            {/* Health Encryption Section */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Health Data Privacy</h4>
              <div className="flex items-center justify-between bg-bg-tertiary p-3 rounded-lg mb-3 border border-border-secondary">
                <span className="text-sm text-text-secondary mr-3">Encrypt Health Data (NIP-44)</span>
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                  checked={healthEncryptionPref === 'encrypted'}
                  onChange={() => {
                    const currentPrefIsEncrypted = healthEncryptionPref === 'encrypted';
                    const newPrefWillBeEncrypted = !currentPrefIsEncrypted;
                    if (newPrefWillBeEncrypted === false) {
                      const confirmDisable = window.confirm(
                        'Publishing health data unencrypted will make the values publicly visible on relays. Are you sure you want to disable encryption?'
                      );
                      if (!confirmDisable) {
                        return;
                      }
                    }
                    setHealthEncryptionPref(newPrefWillBeEncrypted ? 'encrypted' : 'plaintext');
                  }}
                />
              </div>

              {/* Publish Destination Section - ADDED HERE */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Publish Destination</label>
                <ButtonGroup
                  value={publishMode}
                  onValueChange={setPublishMode}
                  options={[
                    { value: 'public', label: 'Public Relays' },
                    { value: 'private', label: 'Private Relay' },
                    { value: 'mixed', label: 'Mixed' }
                  ]}
                  size="sm"
                  className="mb-2"
                />
                {(publishMode === 'private' || publishMode === 'mixed') && (
                  <div className="mt-2">
                    <label htmlFor="privateRelayUrlInputModal" className="block text-xs font-medium text-text-muted mb-1">
                      Private Relay URL (wss://...)
                    </label>
                    <input
                      id="privateRelayUrlInputModal"
                      type="text"
                      value={privateRelayUrl}
                      onChange={e => setPrivateRelayUrl(e.target.value)}
                      placeholder="wss://your-private-relay.com"
                      className="w-full bg-bg-primary p-2 rounded-md text-text-primary text-sm border border-border-secondary focus:ring-primary focus:border-border-focus outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Bitcoin Rewards Section - COMMENTED OUT (moving to manual weekly rewards) */}
            {/*
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Bitcoin Rewards</h4>
              <div className="space-y-2">
                <label htmlFor="lnAddressInput" className="text-sm text-text-secondary">Lightning Address (to receive streak rewards)</label>
                <div className="flex">
                  <input
                    id="lnAddressInput"
                    type="text"
                    defaultValue={localStorage.getItem('lightningAddress') || ''}
                    placeholder="you@getalby.com"
                    className="flex-1 bg-bg-tertiary p-2 rounded-l-lg text-text-primary text-sm"
                  />
                  <button
                    className="bg-secondary px-4 rounded-r-lg text-text-primary text-sm"
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
                <p className="text-xs text-text-muted">If you also connect an NWC wallet, the app will pay that first and fall back to this address if needed.</p>
              </div>
              <p className="text-sm text-text-secondary">
                Runstr now automatically sends Bitcoin rewards directly to your connected Nostr account (via Zaps).
                You no longer need to configure a separate Lightning Address here. Ensure your Nostr profile has a Lightning Address set up to receive rewards.
              </p>
            </div>
            */}
            
            {/* Step Counting Settings Section */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Step Counting (Walking)</h4>
              <div className="space-y-3">
                {/* NEW Pedometer Button - Replaced with Checkbox */}
                <div className="flex items-center justify-between bg-bg-tertiary p-3 rounded-lg mb-3 border border-border-secondary">
                  <span className="text-sm text-text-secondary mr-3">Use Device Step Counter</span>
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                    checked={usePedometer}
                    onChange={() => setUsePedometer(!usePedometer)}
                  />
                </div>
                {/* End Pedometer Checkbox */}
              </div>
            </div>
            
            {/* Blossom Music Server Section */}
            <div className="mb-6">
              <h4 className="subsection-heading mb-3">Music Server</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="blossomEndpointSelect" className="block text-sm font-medium text-text-secondary mb-1">
                    Blossom Music Server
                  </label>
                  <select
                    id="blossomEndpointSelect"
                    value={blossomEndpoint}
                    onChange={e => setBlossomEndpoint(e.target.value)}
                    className="w-full bg-bg-primary p-2 rounded-md text-text-primary text-sm border border-border-secondary focus:ring-primary focus:border-border-focus outline-none"
                  >
                    <option value="">Search All Servers</option>
                    {DEFAULT_SERVERS.map(server => (
                      <option key={server.url} value={server.url}>
                        {server.name} {server.type === 'nip96' ? '(NIP-96)' : '(Blossom)'}
                      </option>
                    ))}
                    <option value="custom">Custom Server...</option>
                  </select>
                </div>
                
                {blossomEndpoint === 'custom' && (
                  <div>
                    <label htmlFor="customBlossomInput" className="block text-sm font-medium text-text-secondary mb-1">
                      Custom Server URL
                    </label>
                    <input
                      id="customBlossomInput"
                      type="text"
                      value={customBlossomUrl}
                      onChange={e => setCustomBlossomUrl(e.target.value)}
                      placeholder="https://your-blossom-server.com"
                      className="w-full bg-bg-primary p-2 rounded-md text-text-primary text-sm border border-border-secondary focus:ring-primary focus:border-border-focus outline-none"
                    />
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handleTestBlossomConnection}
                    disabled={isTestingConnection || (!blossomEndpoint || blossomEndpoint === 'custom' && !customBlossomUrl)}
                    className="px-3 py-1 bg-primary hover:bg-primary-hover disabled:bg-text-muted text-text-primary text-sm rounded-md transition-colors duration-normal"
                  >
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                  {connectionStatus && (
                    <span className={`text-sm ${connectionStatus.success ? 'text-success' : 'text-error'}`}>
                      {connectionStatus.message}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">
                  Choose a specific server or leave blank to search all servers. NIP-96 servers support authenticated file listing, while Blossom servers use direct file access.
                </p>
              </div>
            </div>
            
            {/* COMMENTED OUT - Fallback Lightning Address section (moving to manual weekly rewards) */}
            {/*
            <div className="mb-6">
              <h4 className="subsection-heading mb-2 text-text-primary">Rewards</h4>
              <div className="setting-item bg-bg-tertiary p-3 rounded-md border border-border-secondary">
                <label htmlFor="manualLnAddressInput" className="block text-sm font-medium text-text-secondary mb-1">Fallback Lightning Address</label>
                <input
                  type="email"
                  id="manualLnAddressInput"
                  placeholder="yourname@example.com"
                  value={manualLnAddress}
                  onChange={(e) => setManualLnAddress(e.target.value)}
                  className="w-full p-2 rounded-md bg-bg-primary text-text-primary border border-border-secondary focus:ring-primary focus:border-border-focus outline-none"
                />
                <button 
                  onClick={handleSaveLnAddress} 
                  className="mt-2 w-full px-4 py-2 rounded-md text-sm font-medium bg-primary hover:bg-primary-hover text-text-primary transition-colors duration-normal"
                >
                  Save Address
                </button>
                {lnAddressStatusMessage && <p className="mt-2 text-xs text-center text-text-secondary">{lnAddressStatusMessage}</p>}
                <p className="mt-2 text-xs text-text-muted">
                  This is a global fallback. If Runstr attempts to send a reward and cannot find the recipient's Lightning Address from their Nostr profile, it will use this address instead.
                </p>
              </div>
            </div>
            */}

            <div className="flex flex-col space-y-4">
              <Link 
                to="/wallet" 
                className="flex items-center p-3 bg-bg-tertiary rounded-lg text-text-primary border border-border-secondary hover:bg-bg-secondary transition-colors duration-normal"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-bitcoin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Wallet</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border-secondary shadow-lg h-20 z-40">
        <div className="grid grid-cols-6 h-full">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`menu-bar-item flex flex-col items-center justify-center text-xs transition-colors duration-normal ${
                  isActive 
                    ? 'menu-bar-item-active text-text-primary' 
                    : 'menu-bar-item-inactive text-text-secondary hover:text-text-primary'
                }`}
              >
                {item.icon}
                <span className="text-xs">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
